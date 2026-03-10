import { useEffect, useRef, useState } from 'react'
import Toolbar from './components/Toolbar'
import TrackZone from './components/TrackZone'
import DevicePanel from './components/DevicePanel'
import MidiKeyboard from './components/MidiKeyboard'
import { useToneSynth } from './hooks/useToneSynth'
import { usePanner } from './hooks/usePanner'
import { useLimiter } from './hooks/useLimiter'
import { useTransportController } from './hooks/useTransportController'
import { useTrackSelection, TrackSelectionContext } from './hooks/useTrackSelection'
import './App.css'

declare global {
  interface Window {
    __panicCount?: number
    __activeSteps?: number[]
    __vuMeterLevel?: number
  }
}

function App() {
  const toneSynth = useToneSynth()
  const panner = usePanner()
  const limiter = useLimiter(panner.getMasterGainNode(), panner.getMasterAnalyserNode())
  const transport = useTransportController(toneSynth, panner)
  const [isTrackRecEnabled, setIsTrackRecEnabled] = useState(true)
  const trackSelection = useTrackSelection()

  // Wire synth output through panner graph (once)
  const audioRoutedRef = useRef(false)
  useEffect(() => {
    if (!audioRoutedRef.current) {
      audioRoutedRef.current = true
      const output = toneSynth.getOutput()
      try {
        output.disconnect()
      } catch {
        // may not be connected yet
      }
      panner.connectSource(output)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        getAnalyserNodeL={panner.getAnalyserNodeL}
        getAnalyserNodeR={panner.getAnalyserNodeR}
        trackVolumeDb={toneSynth.volume}
        onVolumeChange={toneSynth.setVolume}
        getMasterAnalyserNodeL={panner.getMasterAnalyserNodeL}
        getMasterAnalyserNodeR={panner.getMasterAnalyserNodeR}
        masterVolumeDb={panner.masterVolume}
        onMasterVolumeChange={panner.setMasterVolume}
      />
      <DevicePanel synth={toneSynth} panner={panner} limiter={limiter} />
      <MidiKeyboard synth={toneSynth} enabled={isTrackRecEnabled} />
    </div>
    </TrackSelectionContext.Provider>
  )
}

export default App
