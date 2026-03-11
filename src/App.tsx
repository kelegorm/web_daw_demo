import { useEffect, useRef, useState } from 'react'
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
import { createAudioEngine } from './engine/audioEngine'
import './App.css'

declare global {
  interface Window {
    __panicCount?: number
    __activeSteps?: number[]
    __vuMeterLevel?: number
  }
}

function App() {
  const audioEngineRef = useRef<ReturnType<typeof createAudioEngine> | null>(null)
  if (!audioEngineRef.current) {
    audioEngineRef.current = createAudioEngine()
  }

  const toneSynth = useToneSynth(audioEngineRef.current.synth)
  const panner = usePanner(audioEngineRef.current.panner)
  const trackStrip = useTrackStrip(audioEngineRef.current.trackStrip)
  const masterStrip = useMasterStrip(audioEngineRef.current.masterStrip)
  const limiter = useLimiter(audioEngineRef.current.limiter)
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
        getAnalyserNodeL={trackStrip.getAnalyserNodeL}
        getAnalyserNodeR={trackStrip.getAnalyserNodeR}
        trackVolumeDb={trackStrip.trackVolume}
        onVolumeChange={trackStrip.setTrackVolume}
        getMasterAnalyserNodeL={masterStrip.getAnalyserNodeL}
        getMasterAnalyserNodeR={masterStrip.getAnalyserNodeR}
        masterVolumeDb={masterStrip.masterVolume}
        onMasterVolumeChange={masterStrip.setMasterVolume}
      />
      <DevicePanel synth={toneSynth} panner={panner} limiter={limiter} />
      <MidiKeyboard synth={toneSynth} enabled={isTrackRecEnabled} />
    </div>
    </TrackSelectionContext.Provider>
  )
}

export default App
