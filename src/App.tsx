import { useEffect, useState } from 'react'
import Toolbar from './components/Toolbar'
import TrackZone from './components/TrackZone'
import DevicePanel from './components/DevicePanel'
import MidiKeyboard from './components/MidiKeyboard'
import { useToneSynth } from './hooks/useToneSynth'
import { usePanner } from './hooks/usePanner'
import { useTrackStrip } from './hooks/useTrackStrip'
import { useMasterStrip } from './hooks/useMasterStrip'
import { useLimiter } from './hooks/useLimiter'
import { useTransportController } from './hooks/useTransportController'
import { useTrackSelection, TrackSelectionContext } from './hooks/useTrackSelection'
import type { AudioEngine } from './engine/audioEngine'
import { useAudioEngine } from './hooks/useAudioEngine'
import {
  DEFAULT_PLAN_SYNTH_ID,
  DEFAULT_PLAN_PANNER_ID,
  DEFAULT_PLAN_TRACK_STRIP_ID,
  DEFAULT_PLAN_LIMITER_ID,
  DEFAULT_PLAN_MASTER_STRIP_ID,
} from './engine/audioGraphPlan'
import './App.css'

declare global {
  interface Window {
    __panicCount?: number
    __activeSteps?: number[]
    __vuMeterLevel?: number
  }
}

function App() {
  const audioEngine = useAudioEngine()

  if (!audioEngine) {
    return <div id="app" />
  }

  return <AppWithEngine audioEngine={audioEngine} />
}

function AppWithEngine({ audioEngine }: { audioEngine: AudioEngine }) {
  const toneSynth = useToneSynth(audioEngine.getSynth(DEFAULT_PLAN_SYNTH_ID))
  const panner = usePanner(audioEngine.getPanner(DEFAULT_PLAN_PANNER_ID))
  const trackStrip = useTrackStrip(audioEngine.getTrackStrip(DEFAULT_PLAN_TRACK_STRIP_ID))
  const masterStrip = useMasterStrip(audioEngine.getMasterStrip(DEFAULT_PLAN_MASTER_STRIP_ID))
  const limiter = useLimiter(audioEngine.getLimiter(DEFAULT_PLAN_LIMITER_ID))
  const transport = useTransportController(toneSynth, trackStrip)
  const [isTrackRecEnabled, setIsTrackRecEnabled] = useState(true)
  const trackSelection = useTrackSelection()

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
    <TrackSelectionContext.Provider value={trackSelection}>
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
          playbackState={transport.playbackState}
          bpm={transport.bpm}
          loop={transport.loop}
          isTrackMuted={transport.isTrackMuted}
          isTrackRecEnabled={isTrackRecEnabled}
          onMuteToggle={transport.setTrackMute}
          onRecToggle={setIsTrackRecEnabled}
          trackMeterSource={trackStrip.meterSource}
          trackVolumeDb={trackStrip.trackVolume}
          onVolumeChange={trackStrip.setTrackVolume}
          masterMeterSource={masterStrip.meterSource}
          masterVolumeDb={masterStrip.masterVolume}
          onMasterVolumeChange={masterStrip.setMasterVolume}
          getPositionSeconds={transport.getPositionSeconds}
        />
        <DevicePanel synth={toneSynth} panner={panner} limiter={limiter} />
        <MidiKeyboard synth={toneSynth} enabled={isTrackRecEnabled} />
      </div>
    </TrackSelectionContext.Provider>
  )
}

export default App
