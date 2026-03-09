import { useCallback, useEffect, useState } from 'react'
import PianoKeyboard from './components/PianoKeyboard'
import Transport from './components/Transport'
import SequencerDisplay from './components/SequencerDisplay'
import ParameterPanel from './components/ParameterPanel'
import VUMeter from './components/VUMeter'
import { useAudioEngine } from './hooks/useAudioEngine'
import { useSequencer } from './hooks/useSequencer'
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
  const [panicSignal, setPanicSignal] = useState(0)

  const noteOn = useCallback((midi: number) => {
    audioEngine.initAudio().then(() => {
      audioEngine.noteOn(midi)
    })
    window.__lastNoteOn = midi
  }, [audioEngine])

  const noteOff = useCallback((midi: number) => {
    window.__lastNoteOff = midi
    audioEngine.noteOff(midi)
  }, [audioEngine])

  const sequencer = useSequencer(noteOn, noteOff, audioEngine.getAudioContext)

  const handleTogglePlay = useCallback(async () => {
    if (!sequencer.isPlaying) {
      await audioEngine.initAudio()
    }
    sequencer.toggle()
  }, [audioEngine, sequencer])

  const handlePanic = useCallback(() => {
    audioEngine.panic()
    setPanicSignal((prev) => prev + 1)
    window.__panicCount = (window.__panicCount ?? 0) + 1
  }, [audioEngine])

  const handleSetParam = useCallback((name: string, value: number) => {
    window.__lastSetParam = { name, value }
    audioEngine.setParam(name, value)
  }, [audioEngine])

  useEffect(() => {
    window.__panicCount = 0
    window.__activeSteps = []
    window.__lastSetParam = undefined
  }, [])

  useEffect(() => {
    if (sequencer.currentStep >= 0) {
      window.__activeSteps = [...(window.__activeSteps ?? []), sequencer.currentStep]
    }
  }, [sequencer.currentStep])

  return (
    <div id="app">
      <div className="app-header">
        <h1 className="app-header-title">Web DAW Demo</h1>
        <VUMeter getAnalyserNode={audioEngine.getAnalyserNode} />
      </div>
      <ParameterPanel setParam={handleSetParam} />
      <SequencerDisplay currentStep={sequencer.currentStep} />
      <Transport
        isPlaying={sequencer.isPlaying}
        onTogglePlay={handleTogglePlay}
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
