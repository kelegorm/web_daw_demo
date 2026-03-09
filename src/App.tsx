import { useCallback, useEffect, useState } from 'react'
import PianoKeyboard from './components/PianoKeyboard'
import Transport from './components/Transport'
import Toolbar from './components/Toolbar'
import SequencerDisplay from './components/SequencerDisplay'
import ParameterPanel from './components/ParameterPanel'
import VUMeter from './components/VUMeter'
import { useAudioEngine } from './hooks/useAudioEngine'
import { useSequencer } from './hooks/useSequencer'
import { getTransport } from 'tone'
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
  const [bpm, setBpm] = useState(120)
  const [loop, setLoop] = useState(false)

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

  const handleBpmChange = useCallback((newBpm: number) => {
    setBpm(newBpm)
    try { getTransport().bpm.value = newBpm } catch { /* not ready */ }
  }, [])

  const handleLoopToggle = useCallback(() => {
    setLoop((prev) => {
      const next = !prev
      try { getTransport().loop = next } catch { /* not ready */ }
      return next
    })
  }, [])

  const handleStop = useCallback(() => {
    sequencer.stop()
  }, [sequencer])

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
      <Toolbar
        isPlaying={sequencer.isPlaying}
        onPlay={handleTogglePlay}
        onStop={handleStop}
        onPanic={handlePanic}
        bpm={bpm}
        onBpmChange={handleBpmChange}
        loop={loop}
        onLoopToggle={handleLoopToggle}
      />
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
