import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import TrackZone from './components/TrackZone'
import type { TrackZoneActions, TrackZoneModel } from './components/TrackZone'
import DevicePanel from './components/DevicePanel'
import MidiKeyboard from './components/MidiKeyboard'
import { useToneSynth, createToneSynth } from './hooks/useToneSynth'
import { usePanner, createPanner } from './hooks/usePanner'
import { useTrackStrip } from './hooks/useTrackStrip'
import { useMasterStrip } from './hooks/useMasterStrip'
import type { MasterStripHook } from './hooks/useMasterStrip'
import { useLimiter } from './hooks/useLimiter'
import { useTransportController } from './hooks/useTransportController'
import {
  useTrackSelection,
} from './hooks/useTrackSelection'
import type { AudioEngine } from './engine/audioEngine'
import { getAudioEngine, DEFAULT_TRACK_ID } from './engine/engineSingleton'
import {
  DEFAULT_PLAN_SYNTH_ID,
  DEFAULT_PLAN_PANNER_ID,
  DEFAULT_PLAN_TRACK_STRIP_ID,
  DEFAULT_PLAN_LIMITER_ID,
  DEFAULT_PLAN_MASTER_STRIP_ID,
} from './engine/audioGraphPlan'
import {
  DEFAULT_MIDI_CLIP_SOURCE,
  DEFAULT_MIDI_CLIP_STORE,
} from './project-runtime/midiClipStore'
import { buildUiRuntime } from './ui-plan/buildUiRuntime'
import { DEFAULT_UI_PLAN } from './ui-plan/defaultUiPlan'
import { resolveInitialTrackId } from './ui-plan/uiPlan'
import './App.css'

declare global {
  interface Window {
    __panicCount?: number
    __activeSteps?: number[]
    __vuMeterLevel?: number
  }
}

const INITIAL_TRACK_ID = resolveInitialTrackId(DEFAULT_UI_PLAN)

// ---------------------------------------------------------------------------
// Module-level device graphs — created once, never recreated.
// The singleton manages: track strip, limiter, master strip.
// Synth and panner are created here and wired into the singleton's track subgraph.
// ---------------------------------------------------------------------------
const _synthGraph = createToneSynth()
const _pannerGraph = createPanner()

// Wire: synth output -> panner input
_pannerGraph.connectSource(_synthGraph.getOutput())

// Wire: panner output -> singleton's track-1 strip input.
// Both use Tone.js's AudioContext, so connect() is valid (no cross-context error).
const _singletonEngine = getAudioEngine()
const _track1Strip = _singletonEngine._legacy.getTrackStripGraph(DEFAULT_TRACK_ID)
_pannerGraph.output.connect(_track1Strip.input)

const _limiterGraph = _singletonEngine._legacy.limiterGraph

// Wrap the singleton's MasterFacade (setGain/getGain) into the MasterStripHook
// shape (setMasterVolume/masterVolume) that buildUiRuntime and useMasterStrip expect.
const _masterFacade = _singletonEngine.getMasterFacade()
const _masterStripHook: MasterStripHook = {
  get masterVolume() { return _masterFacade.getGain() },
  setMasterVolume(db: number) { _masterFacade.setGain(db) },
  get meterSource() { return _masterFacade.meterSource },
}

// ---------------------------------------------------------------------------
// legacyEngineAdapter — implements AudioEngine interface using the singleton's
// internal graphs. Passed to buildUiRuntime for device resolution.
// buildUiRuntime.ts is NOT modified — it receives AudioEngine and calls
// getSynth/getPanner/getTrackStrip/getLimiter/getMasterStrip by module ID.
// ---------------------------------------------------------------------------
const legacyEngineAdapter: AudioEngine = {
  getSynth: (id: string) => {
    if (id !== DEFAULT_PLAN_SYNTH_ID) {
      throw new Error(`[app] unknown synth module id: ${id}`)
    }
    return _synthGraph
  },
  getPanner: (id: string) => {
    if (id !== DEFAULT_PLAN_PANNER_ID) {
      throw new Error(`[app] unknown panner module id: ${id}`)
    }
    return _pannerGraph
  },
  getTrackStrip: (id: string) => {
    if (id !== DEFAULT_PLAN_TRACK_STRIP_ID) {
      throw new Error(`[app] unknown track strip module id: ${id}`)
    }
    return _track1Strip
  },
  getLimiter: (id: string) => {
    if (id !== DEFAULT_PLAN_LIMITER_ID) {
      throw new Error(`[app] unknown limiter module id: ${id}`)
    }
    return _limiterGraph
  },
  getMasterStrip: (id: string) => {
    if (id !== DEFAULT_PLAN_MASTER_STRIP_ID) {
      throw new Error(`[app] unknown master strip module id: ${id}`)
    }
    return _masterStripHook
  },
  dispose: () => {
    // No-op: singleton has no dispose. App-lifetime singleton avoids
    // React lifecycle disposal/recreation bugs (see STATE.md decisions).
  },
}

function App() {
  const toneSynth = useToneSynth(_synthGraph)
  const panner = usePanner(_pannerGraph)
  const trackStrip = useTrackStrip(_track1Strip)
  const masterStrip = useMasterStrip(_masterStripHook)
  const limiter = useLimiter(_limiterGraph)
  const transport = useTransportController(toneSynth, trackStrip, DEFAULT_MIDI_CLIP_SOURCE)
  const [trackRecByTrackId, setTrackRecByTrackId] = useState<Record<string, boolean>>({
    [INITIAL_TRACK_ID]: true,
  })
  const trackSelection = useTrackSelection(INITIAL_TRACK_ID)
  const uiRuntime = buildUiRuntime({
    uiPlan: DEFAULT_UI_PLAN,
    midiClipStore: DEFAULT_MIDI_CLIP_STORE,
    audioEngine: legacyEngineAdapter,
    selectedTrackId: trackSelection.selectedTrack,
  })

  const trackZoneModel: TrackZoneModel = {
    playbackState: transport.playbackState,
    bpm: transport.bpm,
    loop: transport.loop,
    selectedTrackId: trackSelection.selectedTrack,
    getPositionSeconds: transport.getPositionSeconds,
    tracks: uiRuntime.trackZoneModel.tracks.map((runtimeTrack) => ({
      trackId: runtimeTrack.trackId,
      displayName: runtimeTrack.displayName,
      clips: runtimeTrack.clips,
      meterSource: runtimeTrack.trackStrip.meterSource,
      volumeDb: runtimeTrack.trackStrip.trackVolume,
      isMuted: runtimeTrack.trackStrip.isTrackMuted,
      isRecEnabled: trackRecByTrackId[runtimeTrack.trackId] ?? false,
    })),
    masterTrack: {
      trackId: uiRuntime.trackZoneModel.masterTrack.trackId,
      displayName: uiRuntime.trackZoneModel.masterTrack.displayName,
      meterSource: masterStrip.meterSource,
      volumeDb: masterStrip.masterVolume,
    },
  }

  const devicePanelModel = {
    ...uiRuntime.devicePanelModel,
    devices: uiRuntime.devicePanelModel.devices.map((device) => {
      if (device.moduleId === DEFAULT_PLAN_SYNTH_ID) {
        return { ...device, module: toneSynth }
      }
      if (device.moduleId === DEFAULT_PLAN_PANNER_ID) {
        return { ...device, module: panner }
      }
      if (device.moduleId === DEFAULT_PLAN_LIMITER_ID) {
        return { ...device, module: limiter }
      }
      return device
    }),
  }

  const trackZoneActions: TrackZoneActions = {
    selectTrack: (trackId) => trackSelection.selectTrack(trackId),
    setTrackMute: (trackId, muted) => {
      const runtimeTrack = uiRuntime.trackZoneModel.tracks.find((track) => track.trackId === trackId)
      if (!runtimeTrack) {
        return
      }

      if (runtimeTrack.trackStripId === DEFAULT_PLAN_TRACK_STRIP_ID) {
        transport.setTrackMute(muted)
        return
      }

      runtimeTrack.trackStrip.setTrackMuted(muted)
    },
    setTrackRecEnabled: (trackId, recEnabled) => {
      setTrackRecByTrackId((current) => ({ ...current, [trackId]: recEnabled }))
    },
    setTrackVolume: (trackId, db) => {
      const runtimeTrack = uiRuntime.trackZoneModel.tracks.find((track) => track.trackId === trackId)
      if (!runtimeTrack) {
        return
      }

      if (runtimeTrack.trackStripId === DEFAULT_PLAN_TRACK_STRIP_ID) {
        trackStrip.setTrackVolume(db)
        return
      }

      runtimeTrack.trackStrip.setTrackVolume(db)
    },
    setMasterVolume: (db) => masterStrip.setMasterVolume(db),
  }

  useEffect(() => {
    window.__panicCount = 0
    window.__activeSteps = []
  }, [])

  useEffect(() => {
    if (transport.currentStep >= 0) {
      window.__activeSteps = [...(window.__activeSteps ?? []), transport.currentStep]
    }
  }, [transport.currentStep])

  const handlePanic = () => {
    transport.panic()
    window.__panicCount = (window.__panicCount ?? 0) + 1
  }

  return (
    <div id="app">
      <Toolbar
        isPlaying={transport.isPlaying}
        onPlay={transport.toggle}
        onStop={transport.stop}
        onPanic={handlePanic}
        bpm={transport.bpm}
        onBpmChange={transport.setBpm}
        loop={transport.loop}
        onLoopToggle={() => transport.setLoop(!transport.loop)}
      />
      <TrackZone
        model={trackZoneModel}
        actions={trackZoneActions}
      />
      <DevicePanel model={devicePanelModel} />
      <MidiKeyboard synth={toneSynth} enabled={trackRecByTrackId[INITIAL_TRACK_ID] ?? false} />
    </div>
  )
}

export default App
