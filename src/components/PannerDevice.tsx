import Knob from './Knob'
import type { PannerHook } from '../hooks/usePanner'
import { PANNER_PAN_DEFAULT } from '../audio/parameterDefaults'

interface Props {
  panner: PannerHook
}

export default function PannerDevice({ panner }: Props) {
  const handleToggleEnabled = () => {
    panner.setEnabled(!panner.isEnabled)
  }

  const handlePan = (val: number) => {
    panner.setPan(val)
  }

  return (
    <div className="device panner-device" style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 12px',
      gap: 8,
      flex: '0 0 220px',
      width: 220,
      maxWidth: 220,
      minWidth: 220,
      border: '1px solid var(--color-border-strong, var(--color-border, #3a3a48))',
      borderRadius: 'var(--radius-md, 4px)',
      background: 'linear-gradient(180deg, #353544 0%, var(--color-surface-raised, #2e2e38) 100%)',
      boxSizing: 'border-box',
      boxShadow: 'var(--shadow-soft, 0 6px 16px rgba(0, 0, 0, 0.2)), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="device-enable-toggle"
          aria-pressed={panner.isEnabled}
          onClick={handleToggleEnabled}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            border: '1px solid #555',
            background: panner.isEnabled ? 'var(--color-accent, #f5a623)' : '#333',
            cursor: 'pointer',
            padding: 0,
          }}
          title={panner.isEnabled ? 'Disable panner' : 'Enable panner'}
        />
        <span className="device-label" style={{ color: 'var(--color-accent, #f5a623)', fontWeight: 600, fontSize: 13 }}>
          Panner
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 124 }}>
        <Knob
          label="Pan"
          min={-1}
          max={1}
          value={panner.pan}
          onChange={handlePan}
          resetValue={PANNER_PAN_DEFAULT}
          dataTestid="knob-pan"
        />
      </div>
    </div>
  )
}
