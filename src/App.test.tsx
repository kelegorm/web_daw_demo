import * as React from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAudioEngine, DEFAULT_AUDIO_MODULE_FACTORY_MAP } from './engine/audioEngine'
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
} from './project-runtime/midiClipStore'

vi.mock('./engine/audioEngine', () => ({
  createAudioEngine: vi.fn(),
  DEFAULT_AUDIO_MODULE_FACTORY_MAP: {},
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
  default: () => null,
}))

vi.mock('./components/MidiKeyboard', () => ({
  default: () => null,
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

  return {
    getSynth: vi.fn(() => synthHook),
    getPanner: vi.fn(() => pannerHook),
    getTrackStrip: vi.fn(() => trackStripHook),
    getLimiter: vi.fn(() => limiterHook),
    getMasterStrip: vi.fn(() => masterStripHook),
    dispose: vi.fn(),
  }
}

describe('App id-based module wiring', () => {
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

  it('requests modules from engine using DEFAULT_PLAN_*_ID constants', async () => {
    const mockEngine = makeMockEngine()
    vi.mocked(useAudioEngine).mockReturnValue(mockEngine as unknown as ReturnType<typeof createAudioEngine>)

    const App = (await import('./App')).default
    const { useTransportController } = await import('./hooks/useTransportController')
    const TrackZone = (await import('./components/TrackZone')).default

    flushSync(() => {
      root.render(<App />)
    })

    // App must use id-based getters, not legacy direct fields
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
    expect(trackZoneMock).toHaveBeenCalled()
    const trackZoneLastCall = trackZoneMock.mock.calls[trackZoneMock.mock.calls.length - 1]
    const trackZoneProps = trackZoneLastCall?.[0]
    expect(trackZoneProps).toEqual(
      expect.objectContaining({
        model: expect.objectContaining({
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
  })
})
