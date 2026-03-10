import { useEffect, useState } from 'react'
import { ToneSynthHook } from '../hooks/useToneSynth'

interface Props {
  synth: ToneSynthHook
  enabled?: boolean
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
const WHITE_KEY_WIDTH = 40 // px
const KEYBOARD_WIDTH = WHITE_KEY_COUNT * WHITE_KEY_WIDTH // 560px for 14 white keys

export default function MidiKeyboard({ synth, enabled = true }: Props) {
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set())
  const [activeOutputNotes, setActiveOutputNotes] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (enabled || activeOutputNotes.size === 0) return

    activeOutputNotes.forEach((midi) => synth.noteOff(midi))
    setActiveOutputNotes(new Set())
  }, [enabled, activeOutputNotes, synth])

  function handleMouseDown(midi: number) {
    setPressedKeys((prev) => new Set(prev).add(midi))

    if (!enabled) return

    synth.noteOn(midi, 100)
    setActiveOutputNotes((prev) => new Set(prev).add(midi))
  }

  function handleMouseUp(midi: number) {
    setPressedKeys((prev) => {
      const next = new Set(prev)
      next.delete(midi)
      return next
    })

    if (!enabled) return
    if (!activeOutputNotes.has(midi)) return

    synth.noteOff(midi)
    setActiveOutputNotes((prev) => {
      const next = new Set(prev)
      next.delete(midi)
      return next
    })
  }

  function handleMouseLeave(midi: number) {
    if (pressedKeys.has(midi)) {
      setPressedKeys((prev) => {
        const next = new Set(prev)
        next.delete(midi)
        return next
      })

      if (!enabled) return
      if (!activeOutputNotes.has(midi)) return

      synth.noteOff(midi)
      setActiveOutputNotes((prev) => {
        const next = new Set(prev)
        next.delete(midi)
        return next
      })
    }
  }

  const wPx = WHITE_KEY_WIDTH
  const bPx = wPx * 0.6

  return (
    <div
      className="midi-keyboard-strip"
      data-testid="midi-keyboard-strip"
      style={{
        width: '100%',
        height: 100,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        flexShrink: 0,
        background: 'linear-gradient(180deg, #2f2f3b 0%, var(--color-surface) 100%)',
        borderTop: '1px solid var(--color-border-strong, var(--color-border))',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      }}
    >
      <div
        className="keyboard-gutter"
        data-testid="keyboard-gutter-left"
        style={{ flex: 1, background: 'linear-gradient(180deg, #2f2f3b 0%, var(--color-surface) 100%)' }}
      />
      <div
        className="midi-keyboard"
        style={{
          position: 'relative',
          width: KEYBOARD_WIDTH,
          flexShrink: 0,
          height: '100%',
          userSelect: 'none',
          boxShadow: '0 -1px 0 rgba(0, 0, 0, 0.3)',
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
                left: key.whiteIndex * wPx,
                top: 0,
                width: wPx - 1,
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
                left: (key.whiteIndex + 0.5) * wPx - bPx / 2,
                top: 0,
                width: bPx,
                height: '62%',
                background: pressed ? '#555' : '#1a1a1f',
                border: '1px solid #000',
                borderRadius: '0 0 3px 3px',
                cursor: 'pointer',
                boxSizing: 'border-box',
                zIndex: 2,
                boxShadow: pressed
                  ? '0 1px 2px rgba(0,0,0,0.34), 0 0 0.5px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.04)'
                  : '0 4px 5px rgba(0,0,0,0.5), 0.5px 0 1.5px rgba(0,0,0,0.28), -0.5px 0 1.5px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)',
                transition: 'box-shadow 0.08s ease, background 0.08s ease',
              }}
              onMouseDown={() => handleMouseDown(key.midi)}
              onMouseUp={() => handleMouseUp(key.midi)}
              onMouseLeave={() => handleMouseLeave(key.midi)}
            />
          )
        })}
      </div>
      <div
        className="keyboard-gutter"
        data-testid="keyboard-gutter-right"
        style={{ flex: 1, background: 'linear-gradient(180deg, #2f2f3b 0%, var(--color-surface) 100%)' }}
      />
    </div>
  )
}
