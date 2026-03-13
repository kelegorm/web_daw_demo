import { useEffect } from 'react'
import Toolbar from './Toolbar'
import TrackZone from './TrackZone'
import type { TrackZoneActions, TrackZoneModel } from './TrackZone'
import DevicePanel from './DevicePanel'
import type { DevicePanelModel } from '../ui-plan/buildUiRuntime'
import MidiKeyboard from './MidiKeyboard'
import { useToneSynth, createToneSynth } from '../hooks/useToneSynth'
import { usePanner, createPanner } from '../hooks/usePanner'
import { useTrackStrip } from '../hooks/useTrackStrip'
import { useMasterStrip } from '../hooks/useMasterStrip'
import type { MasterStripHook } from '../hooks/useMasterStrip'
import { useLimiter } from '../hooks/useLimiter'
import { useTransportController } from '../hooks/useTransportController'
import { getAudioEngine, DEFAULT_TRACK_ID } from '../engine/engineSingleton'
import {
  DEFAULT_MIDI_CLIP_ID,
  DEFAULT_MIDI_CLIP_SOURCE,
  DEFAULT_MIDI_CLIP_STORE,
} from '../project-runtime/midiClipStore'
import { useUiState } from '../context/useUiState'
import { useDawDispatch } from '../context/useDawDispatch'
import '../App.css'

declare global {
  interface Window {
    __panicCount?: number
    __activeSteps?: number[]
    __vuMeterLevel?: number
  }
}

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
// shape (setMasterVolume/masterVolume) that useMasterStrip expects.
const _masterFacade = _singletonEngine.getMasterFacade()
const _masterStripHook: MasterStripHook = {
  get masterVolume() { return _masterFacade.getGain() },
  setMasterVolume(db: number) { _masterFacade.setGain(db) },
  get meterSource() { return _masterFacade.meterSource },
}

export default function Layout() {
  const toneSynth = useToneSynth(_synthGraph)
  const panner = usePanner(_pannerGraph)
  const trackStrip = useTrackStrip(_track1Strip)
  const masterStrip = useMasterStrip(_masterStripHook)
  const limiter = useLimiter(_limiterGraph)
  const transport = useTransportController(toneSynth, trackStrip, DEFAULT_MIDI_CLIP_SOURCE)

  // COMP-07: selectedTrackId and recArmByTrackId come from context, not local useState.
  const { selectedTrackId, recArmByTrackId } = useUiState()
  const dispatch = useDawDispatch()

  const trackZoneModel: TrackZoneModel = {
    playbackState: transport.playbackState,
    bpm: transport.bpm,
    loop: transport.loop,
    selectedTrackId,
    getPositionSeconds: transport.getPositionSeconds,
    tracks: [{
      trackId: DEFAULT_TRACK_ID,
      displayName: 'synth1',
      clips: [{ clipId: DEFAULT_MIDI_CLIP_ID, clip: DEFAULT_MIDI_CLIP_STORE[DEFAULT_MIDI_CLIP_ID] }],
      meterSource: trackStrip.meterSource,
      volumeDb: trackStrip.trackVolume,
      isMuted: trackStrip.isTrackMuted,
      isRecEnabled: recArmByTrackId[DEFAULT_TRACK_ID] ?? false,
    }],
    masterTrack: {
      trackId: 'master',
      displayName: 'Master',
      meterSource: masterStrip.meterSource,
      volumeDb: masterStrip.masterVolume,
    },
  }

  const devicePanelModel: DevicePanelModel = {
    selectedTrackId,
    selectedTrackDisplayName: selectedTrackId === 'master' ? 'Master' : 'synth1',
    devices: selectedTrackId === 'master'
      ? [{ uiDeviceId: 'dev-limiter', displayName: 'Limiter', moduleId: 'dev-limiter', moduleKind: 'LIMITER' as const, module: limiter }]
      : [
          { uiDeviceId: 'dev-synth', displayName: 'Synth', moduleId: 'dev-synth', moduleKind: 'SYNTH' as const, module: toneSynth },
          { uiDeviceId: 'dev-panner', displayName: 'Panner', moduleId: 'dev-panner', moduleKind: 'PANNER' as const, module: panner },
        ],
  }

  const trackZoneActions: TrackZoneActions = {
    selectTrack: (trackId) => dispatch.selectTrack(trackId),
    setTrackMute: (_trackId, muted) => {
      // Single-track transitional: all mute calls go to transport.setTrackMute.
      // Phase 04-02 will route per-track via useTrackFacade.
      transport.setTrackMute(muted)
    },
    setTrackRecEnabled: (trackId, recEnabled) => dispatch.setRecArm(trackId, recEnabled),
    setTrackVolume: (_trackId, db) => {
      // Single-track transitional: all volume calls go to trackStrip.setTrackVolume.
      // Phase 04-02 will route per-track via useTrackFacade.
      trackStrip.setTrackVolume(db)
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
      <MidiKeyboard synth={toneSynth} enabled={recArmByTrackId[selectedTrackId] ?? false} />
    </div>
  )
}
