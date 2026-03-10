import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    __vuMeterLevel?: number
  }
}

interface Props {
  getAnalyserNodeL: () => AnalyserNode | null
  getAnalyserNodeR: () => AnalyserNode | null
  muted?: boolean
}

const DB_MIN = -60
const DB_MAX = 6
const DB_RANGE = DB_MAX - DB_MIN

function dbToNorm(db: number): number {
  if (!isFinite(db) || db <= DB_MIN) return 0
  return Math.max(0, Math.min(1, (db - DB_MIN) / DB_RANGE))
}

// Zone boundary percentages in the bar gradient (measured from bottom)
const GREEN_MAX_PCT = ((-10 - DB_MIN) / DB_RANGE) * 100
const YELLOW_MAX_PCT = ((0 - DB_MIN) / DB_RANGE) * 100

const GREEN = '#4caf74'
const YELLOW = '#f5c842'
const RED = '#e83b3b'

const BAR_GRADIENT = [
  `linear-gradient(to top,`,
  `${GREEN} 0%,`,
  `${GREEN} ${GREEN_MAX_PCT.toFixed(2)}%,`,
  `${YELLOW} ${GREEN_MAX_PCT.toFixed(2)}%,`,
  `${YELLOW} ${YELLOW_MAX_PCT.toFixed(2)}%,`,
  `${RED} ${YELLOW_MAX_PCT.toFixed(2)}%,`,
  `${RED} 100%)`,
].join(' ')

function zoneColor(db: number): string {
  if (db < -10) return GREEN
  if (db < 0) return YELLOW
  return RED
}

// 0 dB position from bottom as percentage
const ZERO_DB_PCT = ((0 - DB_MIN) / DB_RANGE) * 100

const PEAK_HOLD_MS = 1500
const PEAK_DECAY_NORM_PER_MS = 0.3 / 1000 // 0.3 normalized units per second
const PEAK_HOLD_RESET_EPSILON = 0.02 // ignore tiny jitter so hold timer does not keep resetting

interface ChannelState {
  level: number
  peakNorm: number
  peakDb: number
}

function readRms(analyser: AnalyserNode, buf: Uint8Array): number {
  if (buf.length !== analyser.fftSize) return 0
  analyser.getByteTimeDomainData(buf)
  let sum = 0
  for (let i = 0; i < buf.length; i++) {
    const s = (buf[i] - 128) / 128
    sum += s * s
  }
  return Math.sqrt(sum / buf.length)
}

export default function VUMeter({ getAnalyserNodeL, getAnalyserNodeR, muted = false }: Props) {
  const [left, setLeft] = useState<ChannelState>({ level: 0, peakNorm: 0, peakDb: -Infinity })
  const [right, setRight] = useState<ChannelState>({ level: 0, peakNorm: 0, peakDb: -Infinity })

  const rafRef = useRef<number | null>(null)
  const bufLRef = useRef<Uint8Array | null>(null)
  const bufRRef = useRef<Uint8Array | null>(null)

  // Peak hold state — stored in refs to avoid triggering re-renders on every frame
  const peakLRef = useRef({ norm: 0, db: -Infinity, heldAt: 0, decaying: false })
  const peakRRef = useRef({ norm: 0, db: -Infinity, heldAt: 0, decaying: false })

  useEffect(() => {
    if (muted) {
      setLeft({ level: 0, peakNorm: 0, peakDb: -Infinity })
      setRight({ level: 0, peakNorm: 0, peakDb: -Infinity })
      peakLRef.current = { norm: 0, db: -Infinity, heldAt: 0, decaying: false }
      peakRRef.current = { norm: 0, db: -Infinity, heldAt: 0, decaying: false }
      window.__vuMeterLevel = 0
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    function tick(now: number) {
      const analyserL = getAnalyserNodeL()
      const analyserR = getAnalyserNodeR()

      let normL = 0
      let dbL = -Infinity
      let normR = 0
      let dbR = -Infinity

      if (analyserL) {
        if (!bufLRef.current || bufLRef.current.length !== analyserL.fftSize) {
          bufLRef.current = new Uint8Array(analyserL.fftSize)
        }
        const rms = readRms(analyserL, bufLRef.current)
        dbL = rms > 1e-6 ? 20 * Math.log10(rms) : -Infinity
        normL = dbToNorm(dbL)
      }

      if (analyserR) {
        if (!bufRRef.current || bufRRef.current.length !== analyserR.fftSize) {
          bufRRef.current = new Uint8Array(analyserR.fftSize)
        }
        const rms = readRms(analyserR, bufRRef.current)
        dbR = rms > 1e-6 ? 20 * Math.log10(rms) : -Infinity
        normR = dbToNorm(dbR)
      }

      // Update peak L
      const pkL = peakLRef.current
      if (normL >= pkL.norm + PEAK_HOLD_RESET_EPSILON) {
        const shouldResetHold = pkL.decaying || pkL.heldAt === 0
        pkL.norm = normL
        pkL.db = dbL
        if (shouldResetHold) {
          pkL.heldAt = now
          pkL.decaying = false
        }
      } else if (normL > pkL.norm) {
        pkL.norm = normL
        pkL.db = dbL
      } else {
        if (!pkL.decaying && now - pkL.heldAt > PEAK_HOLD_MS) {
          pkL.decaying = true
        }
        if (pkL.decaying) {
          // approximate dt as 16ms (60fps)
          pkL.norm = Math.max(0, pkL.norm - PEAK_DECAY_NORM_PER_MS * 16)
          if (pkL.norm <= 0) pkL.db = -Infinity
        }
      }

      // Update peak R
      const pkR = peakRRef.current
      if (normR >= pkR.norm + PEAK_HOLD_RESET_EPSILON) {
        const shouldResetHold = pkR.decaying || pkR.heldAt === 0
        pkR.norm = normR
        pkR.db = dbR
        if (shouldResetHold) {
          pkR.heldAt = now
          pkR.decaying = false
        }
      } else if (normR > pkR.norm) {
        pkR.norm = normR
        pkR.db = dbR
      } else {
        if (!pkR.decaying && now - pkR.heldAt > PEAK_HOLD_MS) {
          pkR.decaying = true
        }
        if (pkR.decaying) {
          pkR.norm = Math.max(0, pkR.norm - PEAK_DECAY_NORM_PER_MS * 16)
          if (pkR.norm <= 0) pkR.db = -Infinity
        }
      }

      setLeft({ level: normL, peakNorm: pkL.norm, peakDb: pkL.db })
      setRight({ level: normR, peakNorm: pkR.norm, peakDb: pkR.db })
      window.__vuMeterLevel = Math.max(normL, normR)

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [getAnalyserNodeL, getAnalyserNodeR, muted])

  return (
    <div
      className="vu-meter"
      data-testid="vu-meter"
      style={{
        display: 'flex',
        gap: 1,
        width: '100%',
        height: '100%',
        minWidth: 0,
        background: '#111',
        border: '1px solid #444',
        borderRadius: 2,
        position: 'relative',
        padding: '2px',
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      {/* 0 dB marker line — spans the full width, at ZERO_DB_PCT from bottom */}
      <div
        className="vu-meter-zero-db"
        data-testid="vu-meter-zero-db"
        style={{
          position: 'absolute',
          bottom: `calc(${ZERO_DB_PCT.toFixed(2)}% - 1px)`,
          left: 0,
          right: 0,
          height: 1,
          background: 'rgba(255,255,255,0.5)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Left channel bar */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 2 }}>
        <div
          className="vu-meter-bar"
          data-testid="vu-meter-bar-l"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: `${left.level * 100}%`,
            background: BAR_GRADIENT,
            minHeight: 1,
          }}
        />
        {left.peakNorm > 0 && (
          <div
            className="vu-meter-peak"
            data-testid="vu-meter-peak-l"
            style={{
              position: 'absolute',
              bottom: `${left.peakNorm * 100}%`,
              left: 0,
              width: '100%',
              height: 2,
              background: zoneColor(left.peakDb),
            }}
          />
        )}
      </div>

      {/* Right channel bar */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 2 }}>
        <div
          className="vu-meter-bar"
          data-testid="vu-meter-bar-r"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: `${right.level * 100}%`,
            background: BAR_GRADIENT,
            minHeight: 1,
          }}
        />
        {right.peakNorm > 0 && (
          <div
            className="vu-meter-peak"
            data-testid="vu-meter-peak-r"
            style={{
              position: 'absolute',
              bottom: `${right.peakNorm * 100}%`,
              left: 0,
              width: '100%',
              height: 2,
              background: zoneColor(right.peakDb),
            }}
          />
        )}
      </div>
    </div>
  )
}
