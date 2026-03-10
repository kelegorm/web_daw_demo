import { useEffect, useRef, useState } from 'react'
import Knob from './Knob'
import type { LimiterHook } from '../hooks/useLimiter'
import { LIMITER_THRESHOLD_DEFAULT_DB } from '../audio/parameterDefaults'
import {
  GR_METER_HEIGHT_PX,
  GR_METER_RANGE_DB,
  gainReductionDbToPixels,
} from '../audio/gainReductionMath'

interface Props {
  limiter: LimiterHook
}

export default function LimiterDevice({ limiter }: Props) {
  const [reductionNorm, setReductionNorm] = useState(0)
  const rafRef = useRef<number>(0)
  const getReductionNorm = limiter.getReductionNorm

  useEffect(() => {
    let running = true
    function tick() {
      if (!running) return
      const nextReductionNorm = getReductionNorm()
      setReductionNorm((prev) => {
        const attack = 0.45
        const release = 0.18
        const alpha = nextReductionNorm > prev ? attack : release
        return prev + (nextReductionNorm - prev) * alpha
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [getReductionNorm])

  const handleToggle = () => {
    const next = !limiter.isEnabled
    limiter.setEnabled(next)
  }

  const handleThreshold = (val: number) => {
    limiter.setThreshold(val)
  }

  const reductionBarHeightPx = gainReductionDbToPixels(
    reductionNorm,
    GR_METER_HEIGHT_PX,
  );
  const reductionDb = reductionNorm * GR_METER_RANGE_DB;
  const reductionBarColor = reductionNorm > 0.5 ? '#e04444' : '#f5a623';

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
          aria-pressed={limiter.isEnabled}
          onClick={handleToggle}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            border: '1px solid #555',
            background: limiter.isEnabled ? 'var(--color-accent, #f5a623)' : '#333',
            cursor: 'pointer',
            padding: 0,
          }}
          title={limiter.isEnabled ? 'Disable limiter' : 'Enable limiter'}
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
          value={limiter.threshold}
          onChange={handleThreshold}
          resetValue={LIMITER_THRESHOLD_DEFAULT_DB}
          formatValue={(v) => `${Math.round(v)}dB`}
          dataTestid="knob-limiter-threshold"
        />
        <div
          className="limiter-gr-meter"
          title={`GR: -${reductionDb.toFixed(1)} dB`}
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
              height: GR_METER_HEIGHT_PX,
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
                height: `${reductionBarHeightPx}px`,
                background: reductionBarColor,
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
