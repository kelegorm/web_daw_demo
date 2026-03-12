import {
  renderDeviceFromRegistry,
} from '../ui-plan/deviceRegistry'
import type { DevicePanelModel } from '../ui-plan/buildUiRuntime'

interface Props {
  model: DevicePanelModel
}

export default function DevicePanel({ model }: Props) {
  return (
    <div
      className="device-panel"
      style={{
        width: '100%',
        height: 'var(--device-panel-height, 140px)',
        background: 'linear-gradient(180deg, var(--color-bg-elevated, var(--color-bg, #1a1a1f)) 0%, var(--color-bg, #1a1a1f) 100%)',
        padding: '8px 10px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="device-panel-frame"
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, #31313d 0%, var(--color-surface, #26262e) 100%)',
          border: '1px solid var(--color-border-strong, var(--color-border, #3a3a48))',
          borderRadius: 'var(--radius-md, 4px)',
          boxShadow: 'var(--shadow-soft, 0 6px 16px rgba(0, 0, 0, 0.2)), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
        }}
      >
        <div
          className="device-panel-track-strip"
          style={{
            width: 28,
            flexShrink: 0,
            borderRight: '1px solid var(--color-border, #3a3a48)',
            background: 'linear-gradient(180deg, #363646 0%, #2a2a34 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            className="device-panel-track-name"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              display: 'inline-block',
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'var(--color-text-muted, #888899)',
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'Courier New', Courier, monospace",
              lineHeight: 1,
            }}
          >
            {model.selectedTrackDisplayName}
          </span>
        </div>

        <div
          key={model.selectedTrackId}
          className="device-panel-content"
          style={{
            display: 'flex',
            flexDirection: 'row',
            flex: 1,
            minWidth: 0,
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            gap: 10,
            padding: 9,
            boxSizing: 'border-box',
            overflowX: 'auto',
            animation: 'devicePanelFadeIn 120ms ease',
          }}
        >
          {model.devices.map((device) => (
            <div key={device.uiDeviceId}>
              {renderDeviceFromRegistry({
                uiDeviceId: device.uiDeviceId,
                displayName: device.displayName,
                moduleKind: device.moduleKind,
                module: device.module,
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
