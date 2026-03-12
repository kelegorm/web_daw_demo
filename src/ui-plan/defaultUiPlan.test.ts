import { describe, expect, it } from 'vitest'
import { DEFAULT_AUDIO_GRAPH_PLAN } from '../engine/audioGraphPlan'
import {
  DEFAULT_UI_PLAN,
  DEFAULT_UI_PLAN_LIMITER_DEVICE_ID,
  DEFAULT_UI_PLAN_MASTER_TRACK_ID,
  DEFAULT_UI_PLAN_PANNER_DEVICE_ID,
  DEFAULT_UI_PLAN_SYNTH_DEVICE_ID,
  DEFAULT_UI_PLAN_TRACK_ID,
} from './defaultUiPlan'
import { resolveInitialTrackId, type UiPlan } from './uiPlan'

describe('DEFAULT_UI_PLAN', () => {
  it('matches the current single-track + master layout shape', () => {
    expect(DEFAULT_UI_PLAN.tracks).toHaveLength(1)

    const track = DEFAULT_UI_PLAN.tracks[0]
    expect(track).toMatchObject({
      trackId: DEFAULT_UI_PLAN_TRACK_ID,
      displayName: 'synth1',
      clipIds: expect.any(Array),
    })

    expect(track?.devices).toEqual([
      expect.objectContaining({
        uiDeviceId: DEFAULT_UI_PLAN_SYNTH_DEVICE_ID,
        displayName: 'Synth',
        moduleKind: 'SYNTH',
      }),
      expect.objectContaining({
        uiDeviceId: DEFAULT_UI_PLAN_PANNER_DEVICE_ID,
        displayName: 'Panner',
        moduleKind: 'PANNER',
      }),
    ])

    expect(DEFAULT_UI_PLAN.masterTrack).toMatchObject({
      masterTrackId: DEFAULT_UI_PLAN_MASTER_TRACK_ID,
      displayName: 'Master',
    })

    expect(DEFAULT_UI_PLAN.masterTrack.devices).toEqual([
      expect.objectContaining({
        uiDeviceId: DEFAULT_UI_PLAN_LIMITER_DEVICE_ID,
        displayName: 'Limiter',
        moduleKind: 'LIMITER',
      }),
    ])
  })

  it('keeps UI ids unique and separated from audio module ids', () => {
    const uiTrackIds = DEFAULT_UI_PLAN.tracks.map((track) => track.trackId)
    const uiMasterTrackId = DEFAULT_UI_PLAN.masterTrack.masterTrackId
    const uiDeviceIds = [
      ...DEFAULT_UI_PLAN.tracks.flatMap((track) => track.devices.map((device) => device.uiDeviceId)),
      ...DEFAULT_UI_PLAN.masterTrack.devices.map((device) => device.uiDeviceId),
    ]

    const allUiIds = [...uiTrackIds, uiMasterTrackId, ...uiDeviceIds]
    expect(new Set(allUiIds).size).toBe(allUiIds.length)

    const audioModuleIds = new Set(DEFAULT_AUDIO_GRAPH_PLAN.nodes.map((node) => node.id))
    for (const uiId of allUiIds) {
      expect(audioModuleIds.has(uiId)).toBe(false)
    }
  })

  it('keeps track-strip and device links consistent with audio graph ids and kinds', () => {
    const audioNodeKindById = new Map(
      DEFAULT_AUDIO_GRAPH_PLAN.nodes.map((node) => [node.id, node.kind] as const),
    )

    for (const track of DEFAULT_UI_PLAN.tracks) {
      expect(audioNodeKindById.get(track.trackStripId)).toBe('TRACK_STRIP')
      for (const device of track.devices) {
        expect(audioNodeKindById.get(device.moduleId)).toBe(device.moduleKind)
      }
    }

    expect(audioNodeKindById.get(DEFAULT_UI_PLAN.masterTrack.trackStripId)).toBe('MASTER_STRIP')
    for (const device of DEFAULT_UI_PLAN.masterTrack.devices) {
      expect(audioNodeKindById.get(device.moduleId)).toBe(device.moduleKind)
    }
  })
})

describe('resolveInitialTrackId', () => {
  it('uses explicit initialTrackId when provided', () => {
    expect(resolveInitialTrackId(DEFAULT_UI_PLAN)).toBe(DEFAULT_UI_PLAN.initialTrackId)
  })

  it('falls back to the first regular track id when initialTrackId is omitted', () => {
    const planWithoutInitialTrackId: UiPlan = {
      ...DEFAULT_UI_PLAN,
      initialTrackId: undefined,
    }

    expect(resolveInitialTrackId(planWithoutInitialTrackId)).toBe(DEFAULT_UI_PLAN_TRACK_ID)
  })
})
