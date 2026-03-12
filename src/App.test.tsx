// @vitest-environment jsdom
import * as React from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MeterSource } from './engine/types'
import {
  DEFAULT_MIDI_CLIP_ID,
  DEFAULT_MIDI_CLIP_SOURCE,
  DEFAULT_MIDI_CLIP_STORE,
} from './project-runtime/midiClipStore'
import { DEFAULT_UI_PLAN } from './ui-plan/defaultUiPlan'
import { resolveInitialTrackId } from './ui-plan/uiPlan'

// ---------------------------------------------------------------------------
// Mock the engine singleton so module-level getAudioEngine() call in App.tsx
// returns a controlled fake, not real Web Audio nodes.
// ---------------------------------------------------------------------------
vi.mock('./engine/engineSingleton', () => ({
  DEFAULT_TRACK_ID: 'track-1',
  getAudioEngine: vi.fn(),
  _resetEngineForTesting: vi.fn(),
}))

// Mock createToneSynth and createPanner to avoid real Tone.js / Web Audio nodes
vi.mock('./hooks/useToneSynth', () => ({
  createToneSynth: vi.fn(),
  useToneSynth: vi.fn((hook) => hook),
}))

vi.mock('./hooks/usePanner', () => ({
  createPanner: vi.fn(),
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

function makeMockMeterSource(): MeterSource {
  return { subscribe: vi.fn(() => vi.fn()) }
}

function makeMockTrackStrip() {
  return {
    input: {} as GainNode,
    output: {} as GainNode,
    trackVolume: 0,
    isTrackMuted: false,
    setTrackVolume: vi.fn(),
    setTrackMuted: vi.fn(),
    meterSource: makeMockMeterSource(),
    dispose: vi.fn(),
  }
}

function makeMockLimiterGraph() {
  return {
    input: {} as AudioNode,
    output: {} as AudioNode,
    isEnabled: true,
    threshold: -3,
    setThreshold: vi.fn(),
    setEnabled: vi.fn(),
    getReductionDb: vi.fn(() => 0),
    meterSource: makeMockMeterSource(),
    dispose: vi.fn(),
  }
}

function makeMockSynthGraph() {
  return {
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
    getSynth: vi.fn(() => null),
    getOutput: vi.fn(() => ({} as any)),
  }
}

function makeMockPannerGraph() {
  return {
    input: {} as GainNode,
    output: { connect: vi.fn() } as unknown as GainNode,
    pan: 0,
    isEnabled: true,
    setPan: vi.fn(),
    setEnabled: vi.fn(),
    connectSource: vi.fn(),
    dispose: vi.fn(),
  }
}

function makeMockMasterFacade() {
  let gain = 0
  const meterSource = makeMockMeterSource()
  return {
    get meterSource() { return meterSource },
    setGain: vi.fn((db: number) => { gain = db }),
    getGain: vi.fn(() => gain),
  }
}

function makeMockUiRuntime(
  trackStripHook: ReturnType<typeof makeMockTrackStrip>,
  synthHook: ReturnType<typeof makeMockSynthGraph>,
  pannerHook: { pan: number; isEnabled: boolean; setPan: ReturnType<typeof vi.fn>; setEnabled: ReturnType<typeof vi.fn> },
) {
  return {
    trackZoneModel: {
      selectedTrackId: INITIAL_TRACK_ID,
      tracks: [
        {
          trackId: INITIAL_TRACK_ID,
          displayName: 'synth1',
          trackStripId: 'track-strip',
          trackStrip: trackStripHook,
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
        trackStripId: 'master-strip',
        trackStrip: { masterVolume: 0, setMasterVolume: vi.fn(), meterSource: makeMockMeterSource() },
      },
    },
    devicePanelModel: {
      selectedTrackId: INITIAL_TRACK_ID,
      selectedTrackDisplayName: 'synth1',
      devices: [
        {
          uiDeviceId: 'ui-device-synth',
          displayName: 'Synth',
          moduleId: 'synth',
          moduleKind: 'SYNTH' as const,
          module: synthHook,
        },
        {
          uiDeviceId: 'ui-device-panner',
          displayName: 'Panner',
          moduleId: 'panner',
          moduleKind: 'PANNER' as const,
          module: pannerHook,
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
    const { getAudioEngine } = await import('./engine/engineSingleton')
    const { createToneSynth } = await import('./hooks/useToneSynth')
    const { createPanner } = await import('./hooks/usePanner')

    const mockTrackStrip = makeMockTrackStrip()
    const mockLimiterGraph = makeMockLimiterGraph()
    const mockMasterFacade = makeMockMasterFacade()
    const mockSynthGraph = makeMockSynthGraph()
    const mockPannerGraph = makeMockPannerGraph()

    vi.mocked(createToneSynth).mockReturnValue(mockSynthGraph as any)
    vi.mocked(createPanner).mockReturnValue(mockPannerGraph as any)

    vi.mocked(getAudioEngine).mockReturnValue({
      getTrackFacade: vi.fn(),
      getMasterFacade: vi.fn(() => mockMasterFacade),
      createTrackSubgraph: vi.fn(),
      removeTrackSubgraph: vi.fn(),
      getLimiterInputMeter: vi.fn(() => makeMockMeterSource()),
      getLimiterReductionDb: vi.fn(() => 0),
      _legacy: {
        audioContext: {} as AudioContext,
        limiterGraph: mockLimiterGraph,
        getTrackStripGraph: vi.fn(() => mockTrackStrip),
      },
    } as any)

    const mockPannerHook = { pan: 0, isEnabled: true, setPan: vi.fn(), setEnabled: vi.fn() }
    const App = (await import('./App')).default
    const { useTransportController } = await import('./hooks/useTransportController')
    const TrackZone = (await import('./components/TrackZone')).default
    const DevicePanel = (await import('./components/DevicePanel')).default
    const { buildUiRuntime } = await import('./ui-plan/buildUiRuntime')

    vi.mocked(buildUiRuntime).mockReturnValue(
      makeMockUiRuntime(mockTrackStrip, mockSynthGraph, mockPannerHook) as any,
    )

    flushSync(() => {
      root.render(<App />)
    })

    expect(vi.mocked(buildUiRuntime)).toHaveBeenCalledWith(
      expect.objectContaining({
        uiPlan: DEFAULT_UI_PLAN,
        midiClipStore: DEFAULT_MIDI_CLIP_STORE,
        selectedTrackId: INITIAL_TRACK_ID,
      }),
    )
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
              moduleId: 'synth',
            }),
            expect.objectContaining({
              moduleId: 'panner',
            }),
          ]),
        }),
      }),
    )
  })
})
