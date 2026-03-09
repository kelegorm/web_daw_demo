import { useCallback, useEffect, useRef, useState } from 'react'
import PianoKeyboard from './components/PianoKeyboard'
import Transport from './components/Transport'

// Expose last note events for E2E testing
declare global {
  interface Window {
    __lastNoteOn?: number
    __lastNoteOff?: number
    __panicCount?: number
  }
}

function App() {
  const noteOnCallsRef = useRef<number[]>([])
  const noteOffCallsRef = useRef<number[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [panicSignal, setPanicSignal] = useState(0)

  const noteOn = useCallback((midi: number) => {
    noteOnCallsRef.current.push(midi)
    window.__lastNoteOn = midi
  }, [])

  const noteOff = useCallback((midi: number) => {
    noteOffCallsRef.current.push(midi)
    window.__lastNoteOff = midi
  }, [])

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev)
  }, [])

  const handlePanic = useCallback(() => {
    setPanicSignal((prev) => prev + 1)
    window.__panicCount = (window.__panicCount ?? 0) + 1
  }, [])

  useEffect(() => {
    // Expose for E2E spying
    ;(window as any).__noteOnCalls = noteOnCallsRef.current
    ;(window as any).__noteOffCalls = noteOffCallsRef.current
    window.__panicCount = 0
  }, [])

  return (
    <div id="app">
      <h1>Web DAW Demo</h1>
      <Transport isPlaying={isPlaying} onTogglePlay={handleTogglePlay} onPanic={handlePanic} />
      <PianoKeyboard noteOn={noteOn} noteOff={noteOff} panicSignal={panicSignal} />
    </div>
  )
}

export default App
