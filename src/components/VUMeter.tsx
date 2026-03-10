import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    __vuMeterLevel?: number
  }
}

interface Props {
  getAnalyserNode: () => AnalyserNode | null
  muted?: boolean
}

const DB_MIN = -48
const DB_MAX = 6
const DB_RANGE = DB_MAX - DB_MIN

function dbToNorm(db: number): number {
  if (!isFinite(db) || db <= DB_MIN) return 0
  return Math.max(0, Math.min(1, (db - DB_MIN) / DB_RANGE))
}

// Zone boundary percentages in the bar gradient (measured from bottom)
const GREEN_MAX_PCT = ((-10 - DB_MIN) / DB_RANGE) * 100  // ≈ 70.4%
const YELLOW_MAX_PCT = ((0 - DB_MIN) / DB_RANGE) * 100   // ≈ 88.9%

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

const PEAK_HOLD_MS = 2000

export default function VUMeter({ getAnalyserNode, muted = false }: Props) {
  const [level, setLevel] = useState(0)
  const [peakNorm, setPeakNorm] = useState(0)
  const [peakDb, setPeakDb] = useState(-Infinity)

  const rafRef = useRef<number | null>(null)
  const dataRef = useRef<Uint8Array | null>(null)
  const peakNormRef = useRef(0)
  const peakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (muted) {
      setLevel(0)
      setPeakNorm(0)
      setPeakDb(-Infinity)
      peakNormRef.current = 0
      window.__vuMeterLevel = 0
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    function tick() {
      const analyser = getAnalyserNode()
      if (analyser) {
        if (!dataRef.current || dataRef.current.length !== analyser.fftSize) {
          dataRef.current = new Uint8Array(analyser.fftSize)
        }
        analyser.getByteTimeDomainData(dataRef.current)
        let sum = 0
        for (let i = 0; i < dataRef.current.length; i++) {
          const sample = (dataRef.current[i] - 128) / 128
          sum += sample * sample
        }
        const rms = Math.sqrt(sum / dataRef.current.length)
        const db = rms > 1e-6 ? 20 * Math.log10(rms) : -Infinity
        const norm = dbToNorm(db)

        setLevel(norm)
        window.__vuMeterLevel = norm

        if (norm > peakNormRef.current) {
          peakNormRef.current = norm
          setPeakNorm(norm)
          setPeakDb(db)
          if (peakTimerRef.current) clearTimeout(peakTimerRef.current)
          peakTimerRef.current = setTimeout(() => {
            peakNormRef.current = 0
            setPeakNorm(0)
            setPeakDb(-Infinity)
          }, PEAK_HOLD_MS)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (peakTimerRef.current) clearTimeout(peakTimerRef.current)
    }
  }, [getAnalyserNode, muted])

  const pct = level * 100

  return (
    <div
      className="vu-meter"
      data-testid="vu-meter"
      style={{
        width: 24,
        height: 120,
        background: '#111',
        border: '1px solid #444',
        borderRadius: 3,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className="vu-meter-bar"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: `${pct}%`,
          background: BAR_GRADIENT,
          minHeight: 1,
        }}
      />
      {peakNorm > 0 && (
        <div
          className="vu-meter-peak"
          style={{
            position: 'absolute',
            bottom: `${peakNorm * 100}%`,
            left: 0,
            width: '100%',
            height: 2,
            background: zoneColor(peakDb),
          }}
        />
      )}
    </div>
  )
}
