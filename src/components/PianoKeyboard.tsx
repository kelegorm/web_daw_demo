import { useState, useEffect } from 'react'

interface Props {
  noteOn: (midi: number) => void
  noteOff: (midi: number) => void
  panicSignal?: number
}

// 2 octaves: C3 (48) through B4 (71)
// White keys per octave: C D E F G A B
// Black keys per octave: C# D# _ F# G# A# (no black after E and B)

const NOTES_PER_OCTAVE = 12
const START_MIDI = 48 // C3
const OCTAVES = 2

interface KeyDef {
  midi: number
  isBlack: boolean
  label: string
  // position in white-key units (white keys count from 0)
  whiteIndex: number
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const OCTAVE_LABELS = ['3', '4']


function buildKeys(): KeyDef[] {
  const keys: KeyDef[] = []
  let whiteIndex = 0
  for (let oct = 0; oct < OCTAVES; oct++) {
    for (let semi = 0; semi < NOTES_PER_OCTAVE; semi++) {
      const midi = START_MIDI + oct * NOTES_PER_OCTAVE + semi
      const name = NOTE_NAMES[semi]
      const isBlack = name.includes('#')
      const label = name + OCTAVE_LABELS[oct]
      if (!isBlack) {
        keys.push({ midi, isBlack, label, whiteIndex })
        whiteIndex++
      } else {
        // black key sits between the previous white key and the next
        keys.push({ midi, isBlack, label, whiteIndex: whiteIndex - 0.5 })
      }
    }
  }
  return keys
}

const KEYS = buildKeys()
const WHITE_KEY_COUNT = KEYS.filter((k) => !k.isBlack).length

const WHITE_KEY_WIDTH = 40
const WHITE_KEY_HEIGHT = 140
const BLACK_KEY_WIDTH = 26
const BLACK_KEY_HEIGHT = 88

export default function PianoKeyboard({ noteOn, noteOff, panicSignal }: Props) {
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (panicSignal !== undefined && panicSignal > 0) {
      setPressedKeys(new Set())
    }
  }, [panicSignal])

  function handleMouseDown(midi: number) {
    noteOn(midi)
    setPressedKeys((prev) => new Set(prev).add(midi))
  }

  function handleMouseUp(midi: number) {
    noteOff(midi)
    setPressedKeys((prev) => {
      const next = new Set(prev)
      next.delete(midi)
      return next
    })
  }

  function handleMouseLeave(midi: number) {
    if (pressedKeys.has(midi)) {
      noteOff(midi)
      setPressedKeys((prev) => {
        const next = new Set(prev)
        next.delete(midi)
        return next
      })
    }
  }

  const totalWidth = WHITE_KEY_COUNT * WHITE_KEY_WIDTH

  return (
    <div
      className="piano-keyboard"
      style={{ position: 'relative', width: totalWidth, height: WHITE_KEY_HEIGHT, userSelect: 'none' }}
    >
      {/* Render white keys first, then black keys on top */}
      {KEYS.filter((k) => !k.isBlack).map((key) => {
        const pressed = pressedKeys.has(key.midi)
        return (
          <div
            key={key.midi}
            data-midi={key.midi}
            data-note={key.label}
            className={`piano-key white-key${pressed ? ' pressed' : ''}`}
            style={{
              position: 'absolute',
              left: key.whiteIndex * WHITE_KEY_WIDTH,
              top: 0,
              width: WHITE_KEY_WIDTH - 1,
              height: WHITE_KEY_HEIGHT,
              background: pressed ? '#d0d0d0' : '#fff',
              border: '1px solid #888',
              borderRadius: '0 0 4px 4px',
              cursor: 'pointer',
              boxSizing: 'border-box',
              zIndex: 1,
            }}
            onMouseDown={() => handleMouseDown(key.midi)}
            onMouseUp={() => handleMouseUp(key.midi)}
            onMouseLeave={() => handleMouseLeave(key.midi)}
          />
        )
      })}
      {KEYS.filter((k) => k.isBlack).map((key) => {
        const pressed = pressedKeys.has(key.midi)
        return (
          <div
            key={key.midi}
            data-midi={key.midi}
            data-note={key.label}
            className={`piano-key black-key${pressed ? ' pressed' : ''}`}
            style={{
              position: 'absolute',
              left: key.whiteIndex * WHITE_KEY_WIDTH + WHITE_KEY_WIDTH / 2 - BLACK_KEY_WIDTH / 2,
              top: 0,
              width: BLACK_KEY_WIDTH,
              height: BLACK_KEY_HEIGHT,
              background: pressed ? '#555' : '#222',
              border: '1px solid #000',
              borderRadius: '0 0 3px 3px',
              cursor: 'pointer',
              boxSizing: 'border-box',
              zIndex: 2,
            }}
            onMouseDown={() => handleMouseDown(key.midi)}
            onMouseUp={() => handleMouseUp(key.midi)}
            onMouseLeave={() => handleMouseLeave(key.midi)}
          />
        )
      })}
    </div>
  )
}
