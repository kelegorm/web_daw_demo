import {
  DEFAULT_PLAN_LIMITER_ID,
  DEFAULT_PLAN_MASTER_STRIP_ID,
  DEFAULT_PLAN_PANNER_ID,
  DEFAULT_PLAN_SYNTH_ID,
  DEFAULT_PLAN_TRACK_STRIP_ID,
} from '../engine/audioGraphPlan'
import { DEFAULT_MIDI_CLIP_ID } from '../project-runtime/midiClipStore'
import type { UiPlan } from './uiPlan'

/**
 * default-ui-plan only: stable UI id for the default regular track.
 */
export const DEFAULT_UI_PLAN_TRACK_ID = 'synth1'

/**
 * default-ui-plan only: stable UI id for the default master track.
 */
export const DEFAULT_UI_PLAN_MASTER_TRACK_ID = 'master'

/**
 * default-ui-plan only: stable UI id for the default synth device.
 */
export const DEFAULT_UI_PLAN_SYNTH_DEVICE_ID = 'ui-device-synth'

/**
 * default-ui-plan only: stable UI id for the default panner device.
 */
export const DEFAULT_UI_PLAN_PANNER_DEVICE_ID = 'ui-device-panner'

/**
 * default-ui-plan only: stable UI id for the default limiter device.
 */
export const DEFAULT_UI_PLAN_LIMITER_DEVICE_ID = 'ui-device-limiter'

export const DEFAULT_UI_PLAN: UiPlan = {
  tracks: [
    {
      trackId: DEFAULT_UI_PLAN_TRACK_ID,
      displayName: 'synth1',
      trackStripId: DEFAULT_PLAN_TRACK_STRIP_ID,
      clipIds: [DEFAULT_MIDI_CLIP_ID],
      devices: [
        {
          uiDeviceId: DEFAULT_UI_PLAN_SYNTH_DEVICE_ID,
          displayName: 'Synth',
          moduleId: DEFAULT_PLAN_SYNTH_ID,
          moduleKind: 'SYNTH',
        },
        {
          uiDeviceId: DEFAULT_UI_PLAN_PANNER_DEVICE_ID,
          displayName: 'Panner',
          moduleId: DEFAULT_PLAN_PANNER_ID,
          moduleKind: 'PANNER',
        },
      ],
    },
  ],
  masterTrack: {
    masterTrackId: DEFAULT_UI_PLAN_MASTER_TRACK_ID,
    displayName: 'Master',
    trackStripId: DEFAULT_PLAN_MASTER_STRIP_ID,
    devices: [
      {
        uiDeviceId: DEFAULT_UI_PLAN_LIMITER_DEVICE_ID,
        displayName: 'Limiter',
        moduleId: DEFAULT_PLAN_LIMITER_ID,
        moduleKind: 'LIMITER',
      },
    ],
  },
  initialTrackId: DEFAULT_UI_PLAN_TRACK_ID,
}
