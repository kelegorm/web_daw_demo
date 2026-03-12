import { describe, expect, it, vi } from 'vitest'
import type { AudioEngine } from '../engine/audioEngine'
import type { LimiterHook } from '../hooks/useLimiter'
import type { MasterStripHook } from '../hooks/useMasterStrip'
import type { PannerHook } from '../hooks/usePanner'
import type { ToneSynthHook } from '../hooks/useToneSynth'
import type { TrackStripHook } from '../hooks/useTrackStrip'
import type { MidiClipStore } from '../project-runtime/midiClipStore'
import { buildUiRuntime } from './buildUiRuntime'
import type { UiPlan } from './uiPlan'

interface EngineFixture {
  audioEngine: AudioEngine
  synth: ToneSynthHook
  panner: PannerHook
  limiter: LimiterHook
  trackStrip: TrackStripHook
  masterStrip: MasterStripHook
}

function createEngineFixture(): EngineFixture {
  const synth: ToneSynthHook = {
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

  const panner: PannerHook = {
    pan: 0,
    isEnabled: true,
    setPan: vi.fn(),
    setEnabled: vi.fn(),
  }

  const limiter: LimiterHook = {
    isEnabled: true,
    threshold: -3,
    setThreshold: vi.fn(),
    setEnabled: vi.fn(),
    getReductionDb: vi.fn(() => 0),
    meterSource: {
      subscribe: vi.fn(() => vi.fn()),
    },
  }

  const trackStrip: TrackStripHook = {
    trackVolume: 0,
    isTrackMuted: false,
    setTrackVolume: vi.fn(),
    setTrackMuted: vi.fn(),
    meterSource: {
      subscribe: vi.fn(() => vi.fn()),
    },
  }

  const masterStrip: MasterStripHook = {
    masterVolume: 0,
    setMasterVolume: vi.fn(),
    meterSource: {
      subscribe: vi.fn(() => vi.fn()),
    },
  }

  const synthById = new Map<string, ToneSynthHook>([['module-synth', synth]])
  const pannerById = new Map<string, PannerHook>([['module-panner', panner]])
  const limiterById = new Map<string, LimiterHook>([['module-limiter', limiter]])
  const trackStripById = new Map<string, TrackStripHook>([['module-track-strip', trackStrip]])
  const masterStripById = new Map<string, MasterStripHook>([['module-master-strip', masterStrip]])

  function getRequiredModule<T>(moduleMap: Map<string, T>, id: string): T {
    const module = moduleMap.get(id)
    if (!module) {
      throw new Error(`[audio-engine] unknown module id: ${id}`)
    }

    return module
  }

  const audioEngine: AudioEngine = {
    getSynth: (id) => getRequiredModule(synthById, id),
    getPanner: (id) => getRequiredModule(pannerById, id),
    getTrackStrip: (id) => getRequiredModule(trackStripById, id),
    getLimiter: (id) => getRequiredModule(limiterById, id),
    getMasterStrip: (id) => getRequiredModule(masterStripById, id),
    dispose: vi.fn(),
  }

  return {
    audioEngine,
    synth,
    panner,
    limiter,
    trackStrip,
    masterStrip,
  }
}

function createClipStore(): MidiClipStore {
  return {
    'clip-main': {
      clipId: 'clip-main',
      startBeat: 0,
      lengthSteps: 2,
      steps: [
        {
          enabled: true,
          note: 60,
          velocity: 100,
          gate: 0.8,
        },
        {
          enabled: true,
          note: 64,
          velocity: 100,
          gate: 0.8,
        },
      ],
    },
  }
}

function createUiPlan(): UiPlan {
  return {
    tracks: [
      {
        trackId: 'track-1',
        displayName: 'Track 1',
        trackStripId: 'module-track-strip',
        clipIds: ['clip-main'],
        devices: [
          {
            uiDeviceId: 'ui-device-synth',
            displayName: 'Synth',
            moduleId: 'module-synth',
            moduleKind: 'SYNTH',
          },
          {
            uiDeviceId: 'ui-device-panner',
            displayName: 'Panner',
            moduleId: 'module-panner',
            moduleKind: 'PANNER',
          },
        ],
      },
    ],
    masterTrack: {
      masterTrackId: 'master',
      displayName: 'Master',
      trackStripId: 'module-master-strip',
      devices: [
        {
          uiDeviceId: 'ui-device-limiter',
          displayName: 'Limiter',
          moduleId: 'module-limiter',
          moduleKind: 'LIMITER',
        },
      ],
    },
    initialTrackId: 'track-1',
  }
}

describe('buildUiRuntime', () => {
  it('builds trackZoneModel and devicePanelModel from plan, clip store, and audio engine', () => {
    const fixture = createEngineFixture()
    const clipStore = createClipStore()
    const uiPlan = createUiPlan()

    const runtime = buildUiRuntime({
      uiPlan,
      midiClipStore: clipStore,
      audioEngine: fixture.audioEngine,
      selectedTrackId: 'track-1',
    })

    expect(runtime.trackZoneModel.selectedTrackId).toBe('track-1')
    expect(runtime.trackZoneModel.tracks).toEqual([
      {
        trackId: 'track-1',
        displayName: 'Track 1',
        trackStripId: 'module-track-strip',
        trackStrip: fixture.trackStrip,
        clips: [
          {
            clipId: 'clip-main',
            clip: clipStore['clip-main'],
          },
        ],
      },
    ])
    expect(runtime.trackZoneModel.masterTrack).toEqual({
      trackId: 'master',
      displayName: 'Master',
      trackStripId: 'module-master-strip',
      trackStrip: fixture.masterStrip,
    })

    expect(runtime.devicePanelModel).toEqual({
      selectedTrackId: 'track-1',
      selectedTrackDisplayName: 'Track 1',
      selectedTrackIsMaster: false,
      devices: [
        {
          uiDeviceId: 'ui-device-synth',
          displayName: 'Synth',
          moduleId: 'module-synth',
          moduleKind: 'SYNTH',
          module: fixture.synth,
        },
        {
          uiDeviceId: 'ui-device-panner',
          displayName: 'Panner',
          moduleId: 'module-panner',
          moduleKind: 'PANNER',
          module: fixture.panner,
        },
      ],
    })
  })

  it('stays pure across calls and re-resolves selected track runtime per call', () => {
    const fixture = createEngineFixture()
    const clipStore = createClipStore()
    const uiPlan = createUiPlan()

    const regularRuntime = buildUiRuntime({
      uiPlan,
      midiClipStore: clipStore,
      audioEngine: fixture.audioEngine,
      selectedTrackId: 'track-1',
    })
    const masterRuntime = buildUiRuntime({
      uiPlan,
      midiClipStore: clipStore,
      audioEngine: fixture.audioEngine,
      selectedTrackId: 'master',
    })

    expect(regularRuntime.devicePanelModel.selectedTrackDisplayName).toBe('Track 1')
    expect(regularRuntime.devicePanelModel.devices.map((device) => device.moduleKind)).toEqual([
      'SYNTH',
      'PANNER',
    ])

    expect(masterRuntime.devicePanelModel.selectedTrackDisplayName).toBe('Master')
    expect(masterRuntime.devicePanelModel.selectedTrackIsMaster).toBe(true)
    expect(masterRuntime.devicePanelModel.devices).toEqual([
      {
        uiDeviceId: 'ui-device-limiter',
        displayName: 'Limiter',
        moduleId: 'module-limiter',
        moduleKind: 'LIMITER',
        module: fixture.limiter,
      },
    ])
  })

  it('fails fast when clip id from plan is missing in MidiClipStore', () => {
    const fixture = createEngineFixture()
    const clipStore = createClipStore()
    const uiPlan = {
      ...createUiPlan(),
      tracks: [
        {
          ...createUiPlan().tracks[0],
          clipIds: ['missing-clip-id'],
        },
      ],
    }

    expect(() =>
      buildUiRuntime({
        uiPlan,
        midiClipStore: clipStore,
        audioEngine: fixture.audioEngine,
        selectedTrackId: 'track-1',
      }),
    ).toThrow('Missing MIDI clip for clipId "missing-clip-id"')
  })

  it('fails fast when selectedTrackId is unknown', () => {
    const fixture = createEngineFixture()

    expect(() =>
      buildUiRuntime({
        uiPlan: createUiPlan(),
        midiClipStore: createClipStore(),
        audioEngine: fixture.audioEngine,
        selectedTrackId: 'missing-track',
      }),
    ).toThrow('[ui-plan] unknown selectedTrackId: missing-track')
  })

  it('fails fast when a regular-track device references an unknown module id', () => {
    const fixture = createEngineFixture()

    const uiPlan = createUiPlan()
    uiPlan.tracks[0] = {
      ...uiPlan.tracks[0],
      devices: [
        {
          uiDeviceId: 'ui-device-synth',
          displayName: 'Synth',
          moduleId: 'missing-module-id',
          moduleKind: 'SYNTH',
        },
      ],
    }

    expect(() =>
      buildUiRuntime({
        uiPlan,
        midiClipStore: createClipStore(),
        audioEngine: fixture.audioEngine,
        selectedTrackId: 'track-1',
      }),
    ).toThrow('[audio-engine] unknown module id: missing-module-id')
  })

  it('fails fast when a master-track device reference is invalid even if a regular track is selected', () => {
    const fixture = createEngineFixture()

    const uiPlan = createUiPlan()
    uiPlan.masterTrack = {
      ...uiPlan.masterTrack,
      devices: [
        {
          uiDeviceId: 'ui-device-limiter',
          displayName: 'Limiter',
          moduleId: 'missing-master-device-module',
          moduleKind: 'LIMITER',
        },
      ],
    }

    expect(() =>
      buildUiRuntime({
        uiPlan,
        midiClipStore: createClipStore(),
        audioEngine: fixture.audioEngine,
        selectedTrackId: 'track-1',
      }),
    ).toThrow('[audio-engine] unknown module id: missing-master-device-module')
  })

  it('fails fast when UiDevicePlan.moduleKind is not supported by the device registry', () => {
    const fixture = createEngineFixture()

    const uiPlan = createUiPlan()
    uiPlan.tracks[0] = {
      ...uiPlan.tracks[0],
      devices: [
        {
          uiDeviceId: 'ui-device-unsupported',
          displayName: 'Unsupported Device',
          moduleId: 'module-track-strip',
          moduleKind: 'TRACK_STRIP',
        },
      ],
    }

    expect(() =>
      buildUiRuntime({
        uiPlan,
        midiClipStore: createClipStore(),
        audioEngine: fixture.audioEngine,
        selectedTrackId: 'track-1',
      }),
    ).toThrow('[ui-plan] unsupported ui device module kind: TRACK_STRIP')
  })
})
