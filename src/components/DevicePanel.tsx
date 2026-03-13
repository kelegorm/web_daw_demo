import { useProjectState } from '../context/useProjectState'
import { useUiState } from '../context/useUiState'
import {
  renderDeviceFromRegistry,
} from '../ui-plan/deviceRegistry'
import type { AnyDeviceModule, DeviceModuleKind } from '../ui-plan/deviceRegistry'

// UiRuntimeDeviceModel moved here from buildUiRuntime.ts (04-03).
interface UiRuntimeDeviceModel {
  uiDeviceId: string
  displayName: string
  moduleId: string
  moduleKind: DeviceModuleKind
  module: AnyDeviceModule
}

interface DevicePanelProps {
  /** Narrow Phase-5 seam: reactive device hook return values keyed by device id. */
  deviceModules: Record<string, AnyDeviceModule>
}

export default function DevicePanel({ deviceModules }: DevicePanelProps) {
  const project = useProjectState()
  const ui = useUiState()

  // Determine selected track info from context.
  const isMasterSelected = ui.selectedTrackId === project.masterTrack.id
  const selectedTrack = isMasterSelected ? null : project.tracks.byId[ui.selectedTrackId]
  const selectedTrackDisplayName = isMasterSelected
    ? project.masterTrack.displayName
    : (selectedTrack?.displayName ?? '')
  const deviceIds = isMasterSelected
    ? project.masterTrack.deviceIds
    : (selectedTrack?.deviceIds ?? [])

  // Resolve devices: look up Device metadata from context, module instance from prop.
  const devices: UiRuntimeDeviceModel[] = (deviceIds as string[])
    .map((deviceId) => {
      const device = project.devices[deviceId]
      if (!device) return null
      const module = deviceModules[deviceId]
      if (!module) return null
      return {
        uiDeviceId: device.id,
        displayName: device.displayName,
        moduleId: device.id,
        moduleKind: device.kind as DeviceModuleKind,
        module,
      }
    })
    .filter((d): d is UiRuntimeDeviceModel => d !== null)

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
            {selectedTrackDisplayName}
          </span>
        </div>

        <div
          key={ui.selectedTrackId}
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
          {devices.map((device) => (
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
