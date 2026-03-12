import type { ModuleKind } from '../engine/types'

export interface UiDevicePlan {
  /**
   * Stable UI identifier for rendering/selection. UI namespace only.
   * Never use this as an audio-module lookup key.
   */
  uiDeviceId: string
  displayName: string
  /**
   * Explicit link to an audio-graph module id.
   * Audio namespace only.
   */
  moduleId: string
  moduleKind: ModuleKind
}

export interface UiTrackPlan {
  /**
   * Stable UI track identifier. UI namespace only.
   * Never use this as an audio-module lookup key.
   */
  trackId: string
  displayName: string
  /**
   * Explicit link to an audio track-strip module id.
   * Audio namespace only.
   */
  trackStripId: string
  clipIds: string[]
  devices: UiDevicePlan[]
}

export interface UiMasterTrackPlan {
  /**
   * Stable UI master-track identifier. UI namespace only.
   * Never use this as an audio-module lookup key.
   */
  masterTrackId: string
  displayName: string
  /**
   * Explicit link to the master-strip audio module id.
   * Audio namespace only.
   */
  trackStripId: string
  devices: UiDevicePlan[]
}

export interface UiPlan {
  tracks: UiTrackPlan[]
  masterTrack: UiMasterTrackPlan
  /**
   * Initial selection policy:
   * - when set, use this id
   * - when omitted, use the first regular track id
   */
  initialTrackId?: string
}

export function resolveInitialTrackId(uiPlan: UiPlan): string {
  if (uiPlan.initialTrackId) {
    return uiPlan.initialTrackId
  }

  const firstRegularTrack = uiPlan.tracks[0]
  if (!firstRegularTrack) {
    throw new Error('[ui-plan] missing initialTrackId and no regular tracks are available')
  }

  return firstRegularTrack.trackId
}
