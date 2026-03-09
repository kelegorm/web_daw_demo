import { useState } from 'react'
import Knob from './Knob'
import type { PannerHook } from '../hooks/usePanner'

interface Props {
  panner: PannerHook
}

export default function PannerDevice({ panner }: Props) {
  const [pan, setPanState] = useState(0)

  const handleToggleEnabled = () => {
    panner.setEnabled(!panner.isEnabled)
  }

  const handlePan = (val: number) => {
    setPanState(val)
    panner.setPan(val)
  }

  return (
    <div className="device panner-device" style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 12px',
      gap: 8,
      flex: 1,
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
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <Knob
          label="Pan"
          min={-1}
          max={1}
          value={pan}
          onChange={handlePan}
          dataTestid="knob-pan"
        />
      </div>
    </div>
  )
}
