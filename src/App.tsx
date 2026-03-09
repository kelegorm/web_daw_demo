import { useCallback, useEffect, useState } from 'react'
import PianoKeyboard from './components/PianoKeyboard'
import Transport from './components/Transport'
import SequencerDisplay from './components/SequencerDisplay'
import { useAudioEngine } from './hooks/useAudioEngine'
import { useSequencer } from './hooks/useSequencer'

// Expose last note events for E2E testing
declare global {
  interface Window {
    __lastNoteOn?: number
    __lastNoteOff?: number
    __panicCount?: number
    __activeSteps?: number[]
  }
}

function App() {
  const audioEngine = useAudioEngine()
  const [panicSignal, setPanicSignal] = useState(0)

  const noteOn = useCallback((midi: number) => {
    window.__lastNoteOn = midi
    audioEngine.noteOn(midi)
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

  useEffect(() => {
    window.__panicCount = 0
    window.__activeSteps = []
  }, [])

  useEffect(() => {
    if (sequencer.currentStep >= 0) {
      window.__activeSteps = [...(window.__activeSteps ?? []), sequencer.currentStep]
    }
  }, [sequencer.currentStep])

  return (
    <div id="app">
      <h1>Web DAW Demo</h1>
      <Transport
        isPlaying={sequencer.isPlaying}
        onTogglePlay={handleTogglePlay}
        onPanic={handlePanic}
      />
      <SequencerDisplay currentStep={sequencer.currentStep} />
      <PianoKeyboard
        noteOn={noteOn}
        noteOff={noteOff}
        panicSignal={panicSignal}
      />
    </div>
  )
}

export default App
