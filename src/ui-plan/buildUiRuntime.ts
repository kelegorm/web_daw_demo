/**
 * buildUiRuntime.ts — TYPE EXPORTS ONLY (transitional file).
 *
 * The buildUiRuntime function and all helper functions have been removed.
 * These type exports remain because TrackZone.tsx and DevicePanel.tsx still
 * import them. Plan 04-03 will move these types to their consuming files
 * and delete this module entirely.
 *
 * Do not add new imports or logic here.
 */
import type { MidiClip } from '../project-runtime/midiClipStore'
import type { AnyDeviceModule, DeviceModuleKind } from './deviceRegistry'

export interface UiRuntimeClipModel {
  clipId: string
  clip: MidiClip
}

export interface UiRuntimeDeviceModel {
  uiDeviceId: string
  displayName: string
  moduleId: string
  moduleKind: DeviceModuleKind
  module: AnyDeviceModule
}

export interface DevicePanelModel {
  selectedTrackId: string
  selectedTrackDisplayName: string
  devices: UiRuntimeDeviceModel[]
}
