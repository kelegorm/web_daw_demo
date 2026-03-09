import { useState } from 'react'
import { ToneSynthHook } from '../hooks/useToneSynth'

interface Props {
  synth: ToneSynthHook
}

const NOTES_PER_OCTAVE = 12
const START_MIDI = 48 // C3
const OCTAVES = 2

interface KeyDef {
  midi: number
  isBlack: boolean
  label: string
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
        keys.push({ midi, isBlack, label, whiteIndex: whiteIndex - 0.5 })
      }
    }
  }
  return keys
}

const KEYS = buildKeys()
const WHITE_KEY_COUNT = KEYS.filter((k) => !k.isBlack).length

export default function MidiKeyboard({ synth }: Props) {
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set())

  function handleMouseDown(midi: number) {
    synth.noteOn(midi, 100)
    setPressedKeys((prev) => new Set(prev).add(midi))
  }

  function handleMouseUp(midi: number) {
    synth.noteOff(midi)
    setPressedKeys((prev) => {
      const next = new Set(prev)
      next.delete(midi)
      return next
    })
  }

  function handleMouseLeave(midi: number) {
    if (pressedKeys.has(midi)) {
      synth.noteOff(midi)
      setPressedKeys((prev) => {
        const next = new Set(prev)
        next.delete(midi)
        return next
      })
    }
  }

  const wPct = 100 / WHITE_KEY_COUNT
  const bPct = wPct * 0.6

  return (
    <div
      className="midi-keyboard"
      style={{
        position: 'relative',
        width: '100%',
        height: 100,
        background: 'var(--color-surface)',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
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
              left: `${key.whiteIndex * wPct}%`,
              top: 0,
              width: `calc(${wPct}% - 1px)`,
              height: '100%',
              background: pressed ? '#c8c8c8' : '#f5f5f5',
              border: '1px solid #666',
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
              left: `calc(${(key.whiteIndex + 0.5) * wPct}% - ${bPct / 2}%)`,
              top: 0,
              width: `${bPct}%`,
              height: '62%',
              background: pressed ? '#555' : '#1a1a1f',
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
