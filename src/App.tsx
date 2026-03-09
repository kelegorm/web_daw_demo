import { useCallback, useEffect, useRef } from 'react'
import PianoKeyboard from './components/PianoKeyboard'

// Expose last note events for E2E testing
declare global {
  interface Window {
    __lastNoteOn?: number
    __lastNoteOff?: number
  }
}

function App() {
  const noteOnCallsRef = useRef<number[]>([])
  const noteOffCallsRef = useRef<number[]>([])

  const noteOn = useCallback((midi: number) => {
    noteOnCallsRef.current.push(midi)
    window.__lastNoteOn = midi
  }, [])

  const noteOff = useCallback((midi: number) => {
    noteOffCallsRef.current.push(midi)
    window.__lastNoteOff = midi
  }, [])

  useEffect(() => {
    // Expose for E2E spying
    ;(window as any).__noteOnCalls = noteOnCallsRef.current
    ;(window as any).__noteOffCalls = noteOffCallsRef.current
  }, [])

  return (
    <div id="app">
      <h1>Web DAW Demo</h1>
      <PianoKeyboard noteOn={noteOn} noteOff={noteOff} />
    </div>
  )
}

export default App
