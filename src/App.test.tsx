import * as React from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAudioEngine } from './hooks/useAudioEngine'
import {
  DEFAULT_PLAN_SYNTH_ID,
  DEFAULT_PLAN_PANNER_ID,
  DEFAULT_PLAN_TRACK_STRIP_ID,
  DEFAULT_PLAN_LIMITER_ID,
  DEFAULT_PLAN_MASTER_STRIP_ID,
} from './engine/audioGraphPlan'
import type { MeterSource } from './engine/types'
import {
  DEFAULT_MIDI_CLIP_ID,
  DEFAULT_MIDI_CLIP_SOURCE,
  DEFAULT_MIDI_CLIP_STORE,
} from './project-runtime/midiClipStore'
import { DEFAULT_UI_PLAN } from './ui-plan/defaultUiPlan'
import { resolveInitialTrackId } from './ui-plan/uiPlan'

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
      selectedTrackId: resolveInitialTrackId(DEFAULT_UI_PLAN),
      tracks: [
        {
          trackId: resolveInitialTrackId(DEFAULT_UI_PLAN),
          displayName: 'synth1',
          trackStripId: DEFAULT_PLAN_TRACK_STRIP_ID,
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
        trackStripId: DEFAULT_PLAN_MASTER_STRIP_ID,
        trackStrip: modules.masterStripHook,
      },
    },
    devicePanelModel: {
      selectedTrackId: resolveInitialTrackId(DEFAULT_UI_PLAN),
      selectedTrackDisplayName: 'synth1',
      selectedTrackIsMaster: false,
      devices: [
        {
          uiDeviceId: 'ui-device-synth',
          displayName: 'Synth',
          moduleId: DEFAULT_PLAN_SYNTH_ID,
          moduleKind: 'SYNTH' as const,
          module: modules.synthHook,
        },
        {
          uiDeviceId: 'ui-device-panner',
          displayName: 'Panner',
          moduleId: DEFAULT_PLAN_PANNER_ID,
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
      selectedTrackId: resolveInitialTrackId(DEFAULT_UI_PLAN),
    })
    expect(mockEngine.getSynth).toHaveBeenCalledWith(DEFAULT_PLAN_SYNTH_ID)
    expect(mockEngine.getPanner).toHaveBeenCalledWith(DEFAULT_PLAN_PANNER_ID)
    expect(mockEngine.getTrackStrip).toHaveBeenCalledWith(DEFAULT_PLAN_TRACK_STRIP_ID)
    expect(mockEngine.getLimiter).toHaveBeenCalledWith(DEFAULT_PLAN_LIMITER_ID)
    expect(mockEngine.getMasterStrip).toHaveBeenCalledWith(DEFAULT_PLAN_MASTER_STRIP_ID)
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
          selectedTrackId: resolveInitialTrackId(DEFAULT_UI_PLAN),
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
          selectedTrackId: resolveInitialTrackId(DEFAULT_UI_PLAN),
          selectedTrackDisplayName: 'synth1',
          devices: expect.arrayContaining([
            expect.objectContaining({
              moduleId: DEFAULT_PLAN_SYNTH_ID,
            }),
            expect.objectContaining({
              moduleId: DEFAULT_PLAN_PANNER_ID,
            }),
          ]),
        }),
      }),
    )
  })
})
