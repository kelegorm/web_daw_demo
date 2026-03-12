// @vitest-environment jsdom
import * as React from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAudioEngine } from './hooks/useAudioEngine'
import type { MeterSource } from './engine/types'
import {
  DEFAULT_MIDI_CLIP_ID,
  DEFAULT_MIDI_CLIP_SOURCE,
  DEFAULT_MIDI_CLIP_STORE,
} from './project-runtime/midiClipStore'
import { DEFAULT_UI_PLAN } from './ui-plan/defaultUiPlan'
import { resolveInitialTrackId, type UiDevicePlan } from './ui-plan/uiPlan'

vi.mock('./engine/audioEngine', () => ({
  createAudioEngine: vi.fn(),
}))

vi.mock('./hooks/useAudioEngine', () => ({
  useAudioEngine: vi.fn(),
}))

vi.mock('./hooks/useTransportController', () => ({
  useTransportController: vi.fn(() => ({
    isPlaying: false,
    playbackState: 'stopped',
    bpm: 120,
    loop: false,
    currentStep: -1,
    isTrackMuted: false,
    toggle: vi.fn(),
    stop: vi.fn(),
    panic: vi.fn(),
    setBpm: vi.fn(),
    setLoop: vi.fn(),
    setTrackMute: vi.fn(),
    getPositionSeconds: vi.fn(() => 0),
  })),
}))

vi.mock('./hooks/useToneSynth', () => ({
  useToneSynth: vi.fn((hook) => hook),
}))

vi.mock('./hooks/usePanner', () => ({
  usePanner: vi.fn((hook) => hook),
}))

vi.mock('./hooks/useTrackStrip', () => ({
  useTrackStrip: vi.fn((hook) => hook),
}))

vi.mock('./hooks/useMasterStrip', () => ({
  useMasterStrip: vi.fn((hook) => hook),
}))

vi.mock('./hooks/useLimiter', () => ({
  useLimiter: vi.fn((hook) => hook),
}))

vi.mock('./components/Toolbar', () => ({
  default: () => null,
}))

vi.mock('./components/TrackZone', () => ({
  default: vi.fn(() => null),
}))

vi.mock('./components/DevicePanel', () => ({
  default: vi.fn(() => null),
}))

vi.mock('./components/MidiKeyboard', () => ({
  default: () => null,
}))

vi.mock('./ui-plan/buildUiRuntime', () => ({
  buildUiRuntime: vi.fn(),
}))

const INITIAL_TRACK_ID = resolveInitialTrackId(DEFAULT_UI_PLAN)
const INITIAL_TRACK_PLAN =
  DEFAULT_UI_PLAN.tracks.find((track) => track.trackId === INITIAL_TRACK_ID) ?? DEFAULT_UI_PLAN.tracks[0]

if (!INITIAL_TRACK_PLAN) {
  throw new Error('[test] default UI plan must include at least one regular track')
}

function findDeviceModuleIdByKindOrThrow(devices: UiDevicePlan[], moduleKind: UiDevicePlan['moduleKind']): string {
  const device = devices.find((candidate) => candidate.moduleKind === moduleKind)
  if (!device) {
    throw new Error(`[test] missing ${moduleKind} device in default UI plan`)
  }

  return device.moduleId
}

const EXPECTED_SYNTH_MODULE_ID = findDeviceModuleIdByKindOrThrow(INITIAL_TRACK_PLAN.devices, 'SYNTH')
const EXPECTED_PANNER_MODULE_ID = findDeviceModuleIdByKindOrThrow(INITIAL_TRACK_PLAN.devices, 'PANNER')
const EXPECTED_TRACK_STRIP_ID = INITIAL_TRACK_PLAN.trackStripId
const EXPECTED_LIMITER_MODULE_ID = findDeviceModuleIdByKindOrThrow(DEFAULT_UI_PLAN.masterTrack.devices, 'LIMITER')
const EXPECTED_MASTER_TRACK_STRIP_ID = DEFAULT_UI_PLAN.masterTrack.trackStripId

function makeMockMeterSource(): MeterSource {
  return { subscribe: vi.fn(() => vi.fn()) }
}

function makeMockEngine() {
  const synthHook = {
    isEnabled: true,
    filterCutoff: 2000,
    voiceSpread: 0,
    volume: 0,
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    panic: vi.fn(),
    setFilterCutoff: vi.fn(),
    setVoiceSpread: vi.fn(),
    setVolume: vi.fn(),
    setEnabled: vi.fn(),
  }
  const pannerHook = { pan: 0, isEnabled: true, setPan: vi.fn(), setEnabled: vi.fn() }
  const trackStripHook = {
    trackVolume: 0,
    isTrackMuted: false,
    setTrackVolume: vi.fn(),
    setTrackMuted: vi.fn(),
    meterSource: makeMockMeterSource(),
  }
  const limiterHook = {
    isEnabled: true,
    threshold: -3,
    setThreshold: vi.fn(),
    setEnabled: vi.fn(),
    getReductionDb: vi.fn(() => 0),
    meterSource: makeMockMeterSource(),
  }
  const masterStripHook = {
    masterVolume: 0,
    setMasterVolume: vi.fn(),
    meterSource: makeMockMeterSource(),
  }

  const engine = {
    getSynth: vi.fn(() => synthHook),
    getPanner: vi.fn(() => pannerHook),
    getTrackStrip: vi.fn(() => trackStripHook),
    getLimiter: vi.fn(() => limiterHook),
    getMasterStrip: vi.fn(() => masterStripHook),
    dispose: vi.fn(),
  }

  return {
    engine,
    modules: {
      synthHook,
      pannerHook,
      trackStripHook,
      limiterHook,
      masterStripHook,
    },
  }
}

function makeMockUiRuntime(modules: ReturnType<typeof makeMockEngine>['modules']) {
  return {
    trackZoneModel: {
      selectedTrackId: INITIAL_TRACK_ID,
      tracks: [
        {
          trackId: INITIAL_TRACK_ID,
          displayName: 'synth1',
          trackStripId: EXPECTED_TRACK_STRIP_ID,
          trackStrip: modules.trackStripHook,
          clips: [
            {
              clipId: DEFAULT_MIDI_CLIP_ID,
              clip: DEFAULT_MIDI_CLIP_STORE[DEFAULT_MIDI_CLIP_ID],
            },
          ],
        },
      ],
      masterTrack: {
        trackId: DEFAULT_UI_PLAN.masterTrack.masterTrackId,
        displayName: DEFAULT_UI_PLAN.masterTrack.displayName,
        trackStripId: EXPECTED_MASTER_TRACK_STRIP_ID,
        trackStrip: modules.masterStripHook,
      },
    },
    devicePanelModel: {
      selectedTrackId: INITIAL_TRACK_ID,
      selectedTrackDisplayName: 'synth1',
      devices: [
        {
          uiDeviceId: 'ui-device-synth',
          displayName: 'Synth',
          moduleId: EXPECTED_SYNTH_MODULE_ID,
          moduleKind: 'SYNTH' as const,
          module: modules.synthHook,
        },
        {
          uiDeviceId: 'ui-device-panner',
          displayName: 'Panner',
          moduleId: EXPECTED_PANNER_MODULE_ID,
          moduleKind: 'PANNER' as const,
          module: modules.pannerHook,
        },
      ],
    },
  }
}

describe('App runtime wiring', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.clearAllMocks()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    flushSync(() => {
      root.unmount()
    })
    container.remove()
  })

  it('builds UI runtime from plan and passes runtime models to TrackZone and DevicePanel', async () => {
    const { engine: mockEngine, modules } = makeMockEngine()
    vi.mocked(useAudioEngine).mockReturnValue(mockEngine as unknown as ReturnType<typeof useAudioEngine>)

    const App = (await import('./App')).default
    const { useTransportController } = await import('./hooks/useTransportController')
    const TrackZone = (await import('./components/TrackZone')).default
    const DevicePanel = (await import('./components/DevicePanel')).default
    const { buildUiRuntime } = await import('./ui-plan/buildUiRuntime')

    vi.mocked(buildUiRuntime).mockReturnValue(makeMockUiRuntime(modules))

    flushSync(() => {
      root.render(<App />)
    })

    expect(vi.mocked(buildUiRuntime)).toHaveBeenCalledWith({
      uiPlan: DEFAULT_UI_PLAN,
      midiClipStore: DEFAULT_MIDI_CLIP_STORE,
      audioEngine: mockEngine,
      selectedTrackId: INITIAL_TRACK_ID,
    })
    expect(mockEngine.getSynth).toHaveBeenCalledWith(EXPECTED_SYNTH_MODULE_ID)
    expect(mockEngine.getPanner).toHaveBeenCalledWith(EXPECTED_PANNER_MODULE_ID)
    expect(mockEngine.getTrackStrip).toHaveBeenCalledWith(EXPECTED_TRACK_STRIP_ID)
    expect(mockEngine.getLimiter).toHaveBeenCalledWith(EXPECTED_LIMITER_MODULE_ID)
    expect(mockEngine.getMasterStrip).toHaveBeenCalledWith(EXPECTED_MASTER_TRACK_STRIP_ID)
    expect(vi.mocked(useTransportController)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      DEFAULT_MIDI_CLIP_SOURCE,
    )

    const trackZoneMock = vi.mocked(TrackZone)
    const devicePanelMock = vi.mocked(DevicePanel)
    expect(trackZoneMock).toHaveBeenCalled()
    expect(devicePanelMock).toHaveBeenCalled()

    const trackZoneLastCall = trackZoneMock.mock.calls[trackZoneMock.mock.calls.length - 1]
    const trackZoneProps = trackZoneLastCall?.[0]
    expect(trackZoneProps).toEqual(
      expect.objectContaining({
        model: expect.objectContaining({
          selectedTrackId: INITIAL_TRACK_ID,
          tracks: expect.arrayContaining([
            expect.objectContaining({
              clips: expect.arrayContaining([
                expect.objectContaining({
                  clipId: DEFAULT_MIDI_CLIP_ID,
                }),
              ]),
            }),
          ]),
        }),
        actions: expect.objectContaining({
          selectTrack: expect.any(Function),
          setTrackMute: expect.any(Function),
          setTrackRecEnabled: expect.any(Function),
          setTrackVolume: expect.any(Function),
          setMasterVolume: expect.any(Function),
        }),
      }),
    )

    const devicePanelLastCall = devicePanelMock.mock.calls[devicePanelMock.mock.calls.length - 1]
    const devicePanelProps = devicePanelLastCall?.[0]
    expect(devicePanelProps).toEqual(
      expect.objectContaining({
        model: expect.objectContaining({
          selectedTrackId: INITIAL_TRACK_ID,
          selectedTrackDisplayName: 'synth1',
          devices: expect.arrayContaining([
            expect.objectContaining({
              moduleId: EXPECTED_SYNTH_MODULE_ID,
            }),
            expect.objectContaining({
              moduleId: EXPECTED_PANNER_MODULE_ID,
            }),
          ]),
        }),
      }),
    )
  })
})
