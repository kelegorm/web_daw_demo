import { useEffect, useRef } from 'react'
import Toolbar from './components/Toolbar'
import TrackZone from './components/TrackZone'
import DevicePanel from './components/DevicePanel'
import MidiKeyboard from './components/MidiKeyboard'
import { useToneSynth } from './hooks/useToneSynth'
import { usePanner } from './hooks/usePanner'
import { useTransportController } from './hooks/useTransportController'
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
  const transport = useTransportController(toneSynth, panner)

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
        isPlaying={transport.isPlaying}
        bpm={transport.bpm}
        isTrackMuted={transport.isTrackMuted}
        onMuteToggle={transport.setTrackMute}
        getAnalyserNode={panner.getAnalyserNode}
        onVolumeChange={toneSynth.setVolume}
        getMasterAnalyserNode={panner.getMasterAnalyserNode}
        onMasterVolumeChange={panner.setMasterVolume}
      />
      <DevicePanel synth={toneSynth} panner={panner} />
      <MidiKeyboard synth={toneSynth} />
    </div>
  )
}

export default App
