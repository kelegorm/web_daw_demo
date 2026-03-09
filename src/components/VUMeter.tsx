import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    __vuMeterLevel?: number
  }
}

interface Props {
  getAnalyserNode: () => AnalyserNode | null
}

export default function VUMeter({ getAnalyserNode }: Props) {
  const [level, setLevel] = useState(0)
  const rafRef = useRef<number | null>(null)
  const dataRef = useRef<Uint8Array | null>(null)

  useEffect(() => {
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
        const clamped = Math.min(1, rms * 4)
        setLevel(clamped)
        window.__vuMeterLevel = clamped
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [getAnalyserNode])

  const pct = level * 100

  const barColor =
    pct > 80 ? '#e33' : pct > 50 ? '#fa0' : '#2a7'

  return (
    <div
      className="vu-meter"
      data-testid="vu-meter"
      style={{
        width: 24,
        height: 120,
        background: '#222',
        border: '1px solid #444',
        borderRadius: 3,
        display: 'flex',
        alignItems: 'flex-end',
        overflow: 'hidden',
      }}
    >
      <div
        className="vu-meter-bar"
        style={{
          width: '100%',
          height: `${pct}%`,
          background: barColor,
          transition: 'height 50ms linear, background 50ms linear',
          minHeight: 1,
        }}
      />
    </div>
  )
}
