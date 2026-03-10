import { useEffect, useRef, useState } from 'react'
import { AUDIO_DB_MAX, AUDIO_DB_MIN } from '../audio/parameterDefaults'

declare global {
  interface Window {
    __vuMeterLevel?: number
  }
}

interface Props {
  getAnalyserNodeL: () => AnalyserNode | null
  getAnalyserNodeR: () => AnalyserNode | null
}

const DB_MIN = AUDIO_DB_MIN
const DB_RANGE = AUDIO_DB_MAX - DB_MIN

function dbToNorm(db: number): number {
  if (!isFinite(db) || db <= DB_MIN) return 0
  return Math.max(0, Math.min(1, (db - DB_MIN) / DB_RANGE))
}

function dbToPct(db: number): number {
  return ((db - DB_MIN) / DB_RANGE) * 100
}

const GREEN_DARK = '#2f7f56'
const GREEN_LIGHT = '#69c788'
const YELLOW = '#f5d54a'
const ORANGE = '#f5a623'
const RED = '#e83b3b'
const RED_DARK = '#c92a2a'

const RMS_GREEN_LIGHT_DB = -30
const RMS_YELLOW_DB = -22
const RMS_ORANGE_DB = -16
const RMS_RED_DB = -6

const RMS_BAR_GRADIENT = [
  'linear-gradient(to top,',
  `${GREEN_DARK} 0%,`,
  `${GREEN_LIGHT} ${dbToPct(RMS_GREEN_LIGHT_DB).toFixed(2)}%,`,
  `${YELLOW} ${dbToPct(RMS_YELLOW_DB).toFixed(2)}%,`,
  `${ORANGE} ${dbToPct(RMS_ORANGE_DB).toFixed(2)}%,`,
  `${RED} ${dbToPct(RMS_RED_DB).toFixed(2)}%,`,
  `${RED_DARK} 100%)`,
].join(' ')

function zoneColor(db: number): string {
  if (db < -10) return GREEN_LIGHT
  if (db < 0) return YELLOW
  return RED
}

// 0 dB position from bottom as percentage
const ZERO_DB_PCT = ((0 - DB_MIN) / DB_RANGE) * 100

const PEAK_HOLD_MS = 180
const PEAK_ATTACK_ALPHA = 0.55 // fast but non-zero attack for smoother peak rise
const PEAK_DECAY_NORM_PER_MS = 0.75 / 1000 // smoother fall after hold; avoids jumpy drop perception
const RMS_HOLD_MS = PEAK_HOLD_MS / 2
const RMS_DECAY_NORM_PER_MS = PEAK_DECAY_NORM_PER_MS * 2 // RMS fall is intentionally faster than peak
const PEAK_HOLD_RESET_EPSILON = 0.015 // keep stability but react a bit earlier to new peaks

interface ChannelState {
  level: number
  peakNorm: number
  peakDb: number
}

interface SignalMetrics {
  rms: number
  peak: number
}

function readSignalMetrics(analyser: AnalyserNode, buf: Uint8Array): SignalMetrics {
  if (buf.length !== analyser.fftSize) return { rms: 0, peak: 0 }
  analyser.getByteTimeDomainData(buf)
  let sum = 0
  let peak = 0
  for (let i = 0; i < buf.length; i++) {
    const s = (buf[i] - 128) / 128
    const abs = Math.abs(s)
    if (abs > peak) peak = abs
    sum += s * s
  }
  return {
    rms: Math.sqrt(sum / buf.length),
    peak,
  }
}

export default function VUMeter({ getAnalyserNodeL, getAnalyserNodeR }: Props) {
  const [left, setLeft] = useState<ChannelState>({ level: 0, peakNorm: 0, peakDb: -Infinity })
  const [right, setRight] = useState<ChannelState>({ level: 0, peakNorm: 0, peakDb: -Infinity })

  const rafRef = useRef<number | null>(null)
  const lastFrameNowRef = useRef<number | null>(null)
  const bufLRef = useRef<Uint8Array | null>(null)
  const bufRRef = useRef<Uint8Array | null>(null)

  // Peak hold state — stored in refs to avoid triggering re-renders on every frame
  const peakLRef = useRef({ norm: 0, db: -Infinity, heldAt: 0, decaying: false })
  const peakRRef = useRef({ norm: 0, db: -Infinity, heldAt: 0, decaying: false })
  const rmsLRef = useRef({ norm: 0, db: -Infinity, heldAt: 0, decaying: false })
  const rmsRRef = useRef({ norm: 0, db: -Infinity, heldAt: 0, decaying: false })

  useEffect(() => {
    function tick(now: number) {
      const lastNow = lastFrameNowRef.current ?? now
      const dtMs = Math.max(0, Math.min(100, now - lastNow))
      lastFrameNowRef.current = now

      const analyserL = getAnalyserNodeL()
      const analyserR = getAnalyserNodeR()

      let rmsNormL = 0
      let rmsDbL = -Infinity
      let peakNormL = 0
      let peakDbL = -Infinity
      let rmsNormR = 0
      let rmsDbR = -Infinity
      let peakNormR = 0
      let peakDbR = -Infinity

      if (analyserL) {
        if (!bufLRef.current || bufLRef.current.length !== analyserL.fftSize) {
          bufLRef.current = new Uint8Array(analyserL.fftSize)
        }
        const metrics = readSignalMetrics(analyserL, bufLRef.current)
        rmsDbL = metrics.rms > 1e-6 ? 20 * Math.log10(metrics.rms) : -Infinity
        rmsNormL = dbToNorm(rmsDbL)
        peakDbL = metrics.peak > 1e-6 ? 20 * Math.log10(metrics.peak) : -Infinity
        peakNormL = dbToNorm(peakDbL)
      }

      if (analyserR) {
        if (!bufRRef.current || bufRRef.current.length !== analyserR.fftSize) {
          bufRRef.current = new Uint8Array(analyserR.fftSize)
        }
        const metrics = readSignalMetrics(analyserR, bufRRef.current)
        rmsDbR = metrics.rms > 1e-6 ? 20 * Math.log10(metrics.rms) : -Infinity
        rmsNormR = dbToNorm(rmsDbR)
        peakDbR = metrics.peak > 1e-6 ? 20 * Math.log10(metrics.peak) : -Infinity
        peakNormR = dbToNorm(peakDbR)
      }

      // RMS bar follows the same attack/hold/release ballistics as peak indicator.
      const rmsL = rmsLRef.current
      if (rmsNormL > rmsL.norm) {
        const shouldResetHold = rmsL.decaying
          || rmsL.heldAt === 0
          || rmsNormL >= rmsL.norm + PEAK_HOLD_RESET_EPSILON
        rmsL.norm += (rmsNormL - rmsL.norm) * PEAK_ATTACK_ALPHA
        rmsL.db = rmsDbL
        if (shouldResetHold) {
          rmsL.heldAt = now
          rmsL.decaying = false
        }
      } else {
        if (!rmsL.decaying && now - rmsL.heldAt > RMS_HOLD_MS) {
          rmsL.decaying = true
        }
        if (rmsL.decaying) {
          rmsL.norm = Math.max(0, rmsL.norm - RMS_DECAY_NORM_PER_MS * dtMs)
          if (rmsL.norm <= 0) rmsL.db = -Infinity
        }
      }

      const rmsR = rmsRRef.current
      if (rmsNormR > rmsR.norm) {
        const shouldResetHold = rmsR.decaying
          || rmsR.heldAt === 0
          || rmsNormR >= rmsR.norm + PEAK_HOLD_RESET_EPSILON
        rmsR.norm += (rmsNormR - rmsR.norm) * PEAK_ATTACK_ALPHA
        rmsR.db = rmsDbR
        if (shouldResetHold) {
          rmsR.heldAt = now
          rmsR.decaying = false
        }
      } else {
        if (!rmsR.decaying && now - rmsR.heldAt > RMS_HOLD_MS) {
          rmsR.decaying = true
        }
        if (rmsR.decaying) {
          rmsR.norm = Math.max(0, rmsR.norm - RMS_DECAY_NORM_PER_MS * dtMs)
          if (rmsR.norm <= 0) rmsR.db = -Infinity
        }
      }

      // Update peak L using sample-peak signal, while main bar stays RMS.
      const pkL = peakLRef.current
      if (peakNormL > pkL.norm) {
        const shouldResetHold = pkL.decaying
          || pkL.heldAt === 0
          || peakNormL >= pkL.norm + PEAK_HOLD_RESET_EPSILON
        pkL.norm += (peakNormL - pkL.norm) * PEAK_ATTACK_ALPHA
        pkL.db = peakDbL
        if (shouldResetHold) {
          pkL.heldAt = now
          pkL.decaying = false
        }
      } else {
        if (!pkL.decaying && now - pkL.heldAt > PEAK_HOLD_MS) {
          pkL.decaying = true
        }
        if (pkL.decaying) {
          pkL.norm = Math.max(0, pkL.norm - PEAK_DECAY_NORM_PER_MS * dtMs)
          if (pkL.norm <= 0) pkL.db = -Infinity
        }
      }

      // Update peak R using sample-peak signal, while main bar stays RMS.
      const pkR = peakRRef.current
      if (peakNormR > pkR.norm) {
        const shouldResetHold = pkR.decaying
          || pkR.heldAt === 0
          || peakNormR >= pkR.norm + PEAK_HOLD_RESET_EPSILON
        pkR.norm += (peakNormR - pkR.norm) * PEAK_ATTACK_ALPHA
        pkR.db = peakDbR
        if (shouldResetHold) {
          pkR.heldAt = now
          pkR.decaying = false
        }
      } else {
        if (!pkR.decaying && now - pkR.heldAt > PEAK_HOLD_MS) {
          pkR.decaying = true
        }
        if (pkR.decaying) {
          pkR.norm = Math.max(0, pkR.norm - PEAK_DECAY_NORM_PER_MS * dtMs)
          if (pkR.norm <= 0) pkR.db = -Infinity
        }
      }

      setLeft({ level: rmsL.norm, peakNorm: pkL.norm, peakDb: pkL.db })
      setRight({ level: rmsR.norm, peakNorm: pkR.norm, peakDb: pkR.db })
      // Expose raw RMS activity for tests/debugging; visual bars keep ballistic smoothing.
      window.__vuMeterLevel = Math.max(rmsNormL, rmsNormR)

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      lastFrameNowRef.current = null
    }
  }, [getAnalyserNodeL, getAnalyserNodeR])

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
            background: RMS_BAR_GRADIENT,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'bottom',
            backgroundSize: `100% ${left.level > 0 ? (100 / left.level).toFixed(2) : '100'}%`,
            minHeight: 1,
            zIndex: 0,
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
              height: 1,
              background: zoneColor(left.peakDb),
              boxShadow: `0 0 4px ${zoneColor(left.peakDb)}`,
              zIndex: 3,
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
            background: RMS_BAR_GRADIENT,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'bottom',
            backgroundSize: `100% ${right.level > 0 ? (100 / right.level).toFixed(2) : '100'}%`,
            minHeight: 1,
            zIndex: 0,
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
              height: 1,
              background: zoneColor(right.peakDb),
              boxShadow: `0 0 4px ${zoneColor(right.peakDb)}`,
              zIndex: 3,
            }}
          />
        )}
      </div>
    </div>
  )
}
