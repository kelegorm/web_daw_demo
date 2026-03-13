import { useEffect } from 'react'
import Toolbar from './Toolbar'
import TrackZone from './TrackZone'
import DevicePanel from './DevicePanel'
import MidiKeyboard from './MidiKeyboard'
import { useToneSynth, createToneSynth } from '../hooks/useToneSynth'
import { usePanner, createPanner } from '../hooks/usePanner'
import { useMasterStrip } from '../hooks/useMasterStrip'
import type { MasterStripHook } from '../hooks/useMasterStrip'
import { useLimiter } from '../hooks/useLimiter'
import { useTransportController } from '../hooks/useTransportController'
import { getAudioEngine, DEFAULT_TRACK_ID } from '../engine/engineSingleton'
import {
  DEFAULT_MIDI_CLIP_SOURCE,
} from '../project-runtime/midiClipStore'
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
_singletonEngine.connectToTrackInput(DEFAULT_TRACK_ID, _pannerGraph.output)

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
  const masterStrip = useMasterStrip(_masterStripHook)
  const limiter = useLimiter(_limiterGraph)
  const transport = useTransportController(
    toneSynth,
    (muted) => getAudioEngine().getTrackFacade(DEFAULT_TRACK_ID).setMute(muted),
    DEFAULT_MIDI_CLIP_SOURCE,
  )

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
        transport={{
          playbackState: transport.playbackState,
          bpm: transport.bpm,
          loop: transport.loop,
          getPositionSeconds: transport.getPositionSeconds,
        }}
        masterStrip={{
          volumeDb: masterStrip.masterVolume,
          meterSource: masterStrip.meterSource,
          setMasterVolume: masterStrip.setMasterVolume,
        }}
        onTrackMuteSync={(trackId, muted) => {
          if (trackId === DEFAULT_TRACK_ID) {
            transport.setTrackMute(muted)
          }
        }}
      />
      <DevicePanel
        deviceModules={{
          'dev-synth': toneSynth,
          'dev-panner': panner,
          'dev-limiter': limiter,
        }}
      />
      <MidiKeyboard synth={toneSynth} />
    </div>
  )
}
