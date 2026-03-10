import { useEffect, useRef, useState } from 'react'
import Knob from './Knob'
import VUMeter from './VUMeter'
import type { LimiterHook } from '../hooks/useLimiter'
import { LIMITER_THRESHOLD_DEFAULT_DB } from '../audio/parameterDefaults'
import {
  GR_METER_RANGE_DB,
} from '../audio/gainReductionMath'

interface Props {
  limiter: LimiterHook
}

export default function LimiterDevice({ limiter }: Props) {
  const [reductionDb, setReductionDb] = useState(0)
  const rafRef = useRef<number>(0)
  const getReductionDb = limiter.getReductionDb
  const KNOB_COLUMN_HEIGHT_PX = 108
  const GR_METER_GAP_PX = 4
  const GR_LABEL_HEIGHT_PX = 10
  const INPUT_METER_DB_MIN = -60
  const INPUT_METER_DB_MAX = 6
  const INPUT_METER_DB_RANGE = INPUT_METER_DB_MAX - INPUT_METER_DB_MIN
  const grMeterTrackHeightPx =
    KNOB_COLUMN_HEIGHT_PX - GR_METER_GAP_PX - GR_LABEL_HEIGHT_PX

  useEffect(() => {
    let running = true
    function tick() {
      if (!running) return
      const nextReductionDb = getReductionDb()
      setReductionDb((prev) => {
        const attack = 0.6975
        const release = 0.18
        const alpha = nextReductionDb > prev ? attack : release
        return prev + (nextReductionDb - prev) * alpha
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [getReductionDb])

  const handleToggle = () => {
    const next = !limiter.isEnabled
    limiter.setEnabled(next)
  }

  const handleThreshold = (val: number) => {
    limiter.setThreshold(val)
  }

  const reductionNorm = Math.max(0, Math.min(1, reductionDb / GR_METER_RANGE_DB))
  const reductionBarHeightPx = reductionNorm * grMeterTrackHeightPx
  const reductionBarColor = reductionNorm > 0.5 ? '#e04444' : '#f5a623'
  const thresholdNorm = Math.max(
    0,
    Math.min(1, (limiter.threshold - INPUT_METER_DB_MIN) / INPUT_METER_DB_RANGE),
  )

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
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: KNOB_COLUMN_HEIGHT_PX }}>
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
            gap: GR_METER_GAP_PX,
            height: KNOB_COLUMN_HEIGHT_PX,
            marginLeft: 6,
          }}
        >
          <div
            style={{
              width: 8,
              height: grMeterTrackHeightPx,
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
                top: 0,
                left: 0,
                right: 0,
                height: `${reductionBarHeightPx}px`,
                background: reductionBarColor,
              }}
            />
          </div>
          <span style={{ color: 'var(--color-text-muted, #888899)', fontSize: 9, lineHeight: `${GR_LABEL_HEIGHT_PX}px` }}>
            GR
          </span>
        </div>
        <div
          className="limiter-input-meter"
          title={`Input Meter · Threshold ${Math.round(limiter.threshold)} dB`}
          style={{
            order: -1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: GR_METER_GAP_PX,
            height: KNOB_COLUMN_HEIGHT_PX,
            marginRight: 2,
          }}
        >
          <div
            style={{
              width: 16,
              height: grMeterTrackHeightPx,
              position: 'relative',
            }}
          >
            <VUMeter
              getAnalyserNodeL={limiter.getInputAnalyserNodeL}
              getAnalyserNodeR={limiter.getInputAnalyserNodeR}
            />
            <div
              className="limiter-input-threshold-line"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `calc(${(thresholdNorm * 100).toFixed(2)}% - 1px)`,
                height: 2,
                background: 'rgba(245, 166, 35, 0.95)',
                boxShadow: '0 0 4px rgba(245, 166, 35, 0.45)',
                pointerEvents: 'none',
                zIndex: 3,
              }}
            />
          </div>
          <span style={{ color: 'var(--color-text-muted, #888899)', fontSize: 9, lineHeight: `${GR_LABEL_HEIGHT_PX}px` }}>
            IN
          </span>
        </div>
      </div>
    </div>
  )
}
