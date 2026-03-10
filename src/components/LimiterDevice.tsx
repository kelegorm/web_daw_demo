import { useEffect, useRef, useState } from 'react'
import Knob from './Knob'
import type { LimiterHook } from '../hooks/useLimiter'

interface Props {
  limiter: LimiterHook
}

export default function LimiterDevice({ limiter }: Props) {
  const [threshold, setThresholdState] = useState(limiter.threshold)
  const [enabled, setEnabledState] = useState(limiter.isEnabled)
  const [reduction, setReduction] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    let running = true
    function tick() {
      if (!running) return
      const limiterNode = limiter.getLimiterNode()
      // reduction is negative dB (0 = no reduction)
      const r = limiterNode.reduction ?? 0
      setReduction(Math.abs(r))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [limiter])

  const handleToggle = () => {
    const next = !enabled
    setEnabledState(next)
    limiter.setEnabled(next)
  }

  const handleThreshold = (val: number) => {
    setThresholdState(val)
    limiter.setThreshold(val)
  }

  // Clamp reduction display to 0–30 dB range
  const reductionBarHeight = Math.min((reduction / 30) * 100, 100)

  return (
    <div className="device limiter-device" style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 12px',
      gap: 8,
      flex: '0 0 200px',
      width: 200,
      maxWidth: 200,
      minWidth: 200,
      border: '1px solid var(--color-border-strong, var(--color-border, #3a3a48))',
      borderRadius: 'var(--radius-md, 4px)',
      background: 'linear-gradient(180deg, #353544 0%, var(--color-surface-raised, #2e2e38) 100%)',
      boxSizing: 'border-box',
      boxShadow: 'var(--shadow-soft, 0 6px 16px rgba(0, 0, 0, 0.2)), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="device-enable-toggle"
          aria-pressed={enabled}
          onClick={handleToggle}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            border: '1px solid #555',
            background: enabled ? 'var(--color-accent, #f5a623)' : '#333',
            cursor: 'pointer',
            padding: 0,
          }}
          title={enabled ? 'Disable limiter' : 'Enable limiter'}
        />
        <span className="device-label" style={{ color: 'var(--color-accent, #f5a623)', fontWeight: 600, fontSize: 13 }}>
          Limiter
        </span>
        <span style={{ color: 'var(--color-text-muted, #888899)', fontSize: 10, marginLeft: 4, letterSpacing: 0.5 }}>
          Master FX
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 80 }}>
        <Knob
          label="Threshold"
          min={-30}
          max={0}
          value={threshold}
          onChange={handleThreshold}
          formatValue={(v) => `${Math.round(v)}dB`}
          dataTestid="knob-limiter-threshold"
        />
        <div
          className="limiter-gr-meter"
          title={`GR: -${reduction.toFixed(1)} dB`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            paddingTop: 4,
          }}
        >
          <div
            style={{
              width: 8,
              height: 60,
              background: '#1a1a22',
              borderRadius: 2,
              border: '1px solid #444',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              className="limiter-gr-bar"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${reductionBarHeight}%`,
                background: reductionBarHeight > 50 ? '#e04444' : '#f5a623',
                transition: 'height 60ms linear',
              }}
            />
          </div>
          <span style={{ color: 'var(--color-text-muted, #888899)', fontSize: 9 }}>GR</span>
        </div>
      </div>
    </div>
  )
}
