import type { AudioEngine } from '../engine/audioEngine'
import type { MasterStripHook } from '../hooks/useMasterStrip'
import type { TrackStripHook } from '../hooks/useTrackStrip'
import {
  getMidiClipOrThrow,
  type MidiClip,
  type MidiClipStore,
} from '../project-runtime/midiClipStore'
import {
  getDeviceRegistryEntry,
  type AnyDeviceModule,
  type DeviceModuleKind,
} from './deviceRegistry'
import type { UiDevicePlan, UiPlan, UiTrackPlan } from './uiPlan'

export interface BuildUiRuntimeInput {
  uiPlan: UiPlan
  midiClipStore: MidiClipStore
  audioEngine: AudioEngine
  selectedTrackId: string
}

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

export interface TrackZoneTrackModel {
  trackId: string
  displayName: string
  trackStripId: string
  trackStrip: TrackStripHook
  clips: UiRuntimeClipModel[]
}

export interface TrackZoneMasterTrackModel {
  trackId: string
  displayName: string
  trackStripId: string
  trackStrip: MasterStripHook
}

export interface TrackZoneModel {
  selectedTrackId: string
  tracks: TrackZoneTrackModel[]
  masterTrack: TrackZoneMasterTrackModel
}

export interface DevicePanelModel {
  selectedTrackId: string
  selectedTrackDisplayName: string
  selectedTrackIsMaster: boolean
  devices: UiRuntimeDeviceModel[]
}

export interface UiRuntime {
  trackZoneModel: TrackZoneModel
  devicePanelModel: DevicePanelModel
}

interface ResolvedTrackRuntime extends TrackZoneTrackModel {
  devices: UiRuntimeDeviceModel[]
}

interface ResolvedMasterTrackRuntime extends TrackZoneMasterTrackModel {
  devices: UiRuntimeDeviceModel[]
}

function resolveTrackClips(track: UiTrackPlan, midiClipStore: MidiClipStore): UiRuntimeClipModel[] {
  return track.clipIds.map((clipId) => ({
    clipId,
    clip: getMidiClipOrThrow(midiClipStore, clipId),
  }))
}

function resolveDevice(device: UiDevicePlan, audioEngine: AudioEngine): UiRuntimeDeviceModel {
  const registryEntry = getDeviceRegistryEntry(device.moduleKind)
  const module = registryEntry.resolveModule(audioEngine, device.moduleId)

  return {
    uiDeviceId: device.uiDeviceId,
    displayName: device.displayName,
    moduleId: device.moduleId,
    moduleKind: registryEntry.moduleKind,
    module,
  }
}

function resolveRegularTrackRuntime(
  track: UiTrackPlan,
  midiClipStore: MidiClipStore,
  audioEngine: AudioEngine,
): ResolvedTrackRuntime {
  return {
    trackId: track.trackId,
    displayName: track.displayName,
    trackStripId: track.trackStripId,
    trackStrip: audioEngine.getTrackStrip(track.trackStripId),
    clips: resolveTrackClips(track, midiClipStore),
    devices: track.devices.map((device) => resolveDevice(device, audioEngine)),
  }
}

function resolveMasterTrackRuntime(input: BuildUiRuntimeInput): ResolvedMasterTrackRuntime {
  return {
    trackId: input.uiPlan.masterTrack.masterTrackId,
    displayName: input.uiPlan.masterTrack.displayName,
    trackStripId: input.uiPlan.masterTrack.trackStripId,
    trackStrip: input.audioEngine.getMasterStrip(input.uiPlan.masterTrack.trackStripId),
    devices: input.uiPlan.masterTrack.devices.map((device) => resolveDevice(device, input.audioEngine)),
  }
}

function resolveSelectedTrackRuntime(
  selectedTrackId: string,
  resolvedTracks: ResolvedTrackRuntime[],
  resolvedMasterTrack: ResolvedMasterTrackRuntime,
): {
  selectedTrackId: string
  selectedTrackDisplayName: string
  selectedTrackIsMaster: boolean
  devices: UiRuntimeDeviceModel[]
} {
  if (selectedTrackId === resolvedMasterTrack.trackId) {
    return {
      selectedTrackId,
      selectedTrackDisplayName: resolvedMasterTrack.displayName,
      selectedTrackIsMaster: true,
      devices: resolvedMasterTrack.devices,
    }
  }

  const selectedRegularTrack = resolvedTracks.find((track) => track.trackId === selectedTrackId)
  if (!selectedRegularTrack) {
    throw new Error(`[ui-plan] unknown selectedTrackId: ${selectedTrackId}`)
  }

  return {
    selectedTrackId,
    selectedTrackDisplayName: selectedRegularTrack.displayName,
    selectedTrackIsMaster: false,
    devices: selectedRegularTrack.devices,
  }
}

export function buildUiRuntime(input: BuildUiRuntimeInput): UiRuntime {
  const resolvedTracks = input.uiPlan.tracks.map((track) =>
    resolveRegularTrackRuntime(track, input.midiClipStore, input.audioEngine),
  )
  const resolvedMasterTrack = resolveMasterTrackRuntime(input)
  const selectedTrackRuntime = resolveSelectedTrackRuntime(
    input.selectedTrackId,
    resolvedTracks,
    resolvedMasterTrack,
  )

  return {
    trackZoneModel: {
      selectedTrackId: input.selectedTrackId,
      tracks: resolvedTracks.map((track) => ({
        trackId: track.trackId,
        displayName: track.displayName,
        trackStripId: track.trackStripId,
        trackStrip: track.trackStrip,
        clips: track.clips,
      })),
      masterTrack: {
        trackId: resolvedMasterTrack.trackId,
        displayName: resolvedMasterTrack.displayName,
        trackStripId: resolvedMasterTrack.trackStripId,
        trackStrip: resolvedMasterTrack.trackStrip,
      },
    },
    devicePanelModel: selectedTrackRuntime,
  }
}
