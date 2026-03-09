import { useEffect, useState } from 'react'
import PianoKeyboard from './components/PianoKeyboard'
import Transport from './components/Transport'
import Toolbar from './components/Toolbar'
import TrackZone from './components/TrackZone'
import DevicePanel from './components/DevicePanel'
import SequencerDisplay from './components/SequencerDisplay'
import ParameterPanel from './components/ParameterPanel'
import VUMeter from './components/VUMeter'
import { useAudioEngine } from './hooks/useAudioEngine'
import { useToneSynth } from './hooks/useToneSynth'
import { usePanner } from './hooks/usePanner'
import { useTransportController } from './hooks/useTransportController'
import './App.css'

// Expose last note events for E2E testing
declare global {
  interface Window {
    __lastNoteOn?: number
    __lastNoteOff?: number
    __panicCount?: number
    __activeSteps?: number[]
    __lastSetParam?: { name: string; value: number }
  }
}

function App() {
  const audioEngine = useAudioEngine()
  const toneSynth = useToneSynth()
  const panner = usePanner()

  // Single source of truth for transport + mute state
  const transport = useTransportController(toneSynth, panner)
  const [panicSignal, setPanicSignal] = useState(0)

  const noteOn = (midi: number) => {
    audioEngine.initAudio().then(() => {
      audioEngine.noteOn(midi)
    })
    window.__lastNoteOn = midi
  }

  const noteOff = (midi: number) => {
    window.__lastNoteOff = midi
    audioEngine.noteOff(midi)
  }

  const handlePanic = () => {
    audioEngine.panic()
    transport.panic()
    setPanicSignal((prev) => prev + 1)
    window.__panicCount = (window.__panicCount ?? 0) + 1
  }

  const handleSetParam = (name: string, value: number) => {
    window.__lastSetParam = { name, value }
    audioEngine.setParam(name, value)
  }

  const handlePlay = async () => {
    await audioEngine.initAudio()
    await transport.toggle()
  }

  useEffect(() => {
    window.__panicCount = 0
    window.__activeSteps = []
    window.__lastSetParam = undefined
  }, [])

  useEffect(() => {
    if (transport.currentStep >= 0) {
      window.__activeSteps = [...(window.__activeSteps ?? []), transport.currentStep]
    }
  }, [transport.currentStep])

  return (
    <div id="app">
      <Toolbar
        isPlaying={transport.isPlaying}
        onPlay={handlePlay}
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
      />
      <DevicePanel synth={toneSynth} panner={panner} />
      <div className="app-header">
        <h1 className="app-header-title">Web DAW Demo</h1>
        <VUMeter getAnalyserNode={audioEngine.getAnalyserNode} />
      </div>
      <ParameterPanel setParam={handleSetParam} />
      <SequencerDisplay currentStep={transport.currentStep} />
      <Transport
        isPlaying={transport.isPlaying}
        onTogglePlay={handlePlay}
        onPanic={handlePanic}
      />
      <PianoKeyboard
        noteOn={noteOn}
        noteOff={noteOff}
        panicSignal={panicSignal}
      />
    </div>
  )
}

export default App
