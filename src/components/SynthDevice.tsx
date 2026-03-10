import { useState } from 'react'
import Knob from './Knob'
import type { ToneSynthHook } from '../hooks/useToneSynth'

interface Props {
  synth: ToneSynthHook
}

export default function SynthDevice({ synth }: Props) {
  const [enabled, setEnabled] = useState(true)
  const [filterCutoff, setFilterCutoff] = useState(2000)
  const [voiceSpread, setVoiceSpread] = useState(0)
  const [volume, setVolume] = useState(-12)

  const handleToggleEnabled = () => {
    const next = !enabled
    setEnabled(next)
    synth.setEnabled(next)
  }

  const handleFilterCutoff = (val: number) => {
    setFilterCutoff(val)
    synth.setFilterCutoff(val)
  }

  const handleVoiceSpread = (val: number) => {
    setVoiceSpread(val)
    synth.setVoiceSpread(val)
  }

  const handleVolume = (val: number) => {
    setVolume(val)
    synth.setVolume(val)
  }

  const formatHz = (v: number) => {
    return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`
  }

  return (
    <div className="device synth-device" style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 12px',
      gap: 8,
      flex: '0 0 320px',
      width: 320,
      maxWidth: 320,
      minWidth: 320,
      border: '1px solid var(--color-border, #3a3a48)',
      borderRadius: 'var(--radius-md, 4px)',
      background: 'var(--color-surface-raised, #2e2e38)',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="device-enable-toggle"
          aria-pressed={enabled}
          onClick={handleToggleEnabled}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            border: '1px solid #555',
            background: enabled ? 'var(--color-accent, #f5a623)' : '#333',
            cursor: 'pointer',
            padding: 0,
          }}
          title={enabled ? 'Disable synth' : 'Enable synth'}
        />
        <span className="device-label" style={{ color: 'var(--color-accent, #f5a623)', fontWeight: 600, fontSize: 13 }}>
          Polysynth
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 124 }}>
        <Knob
          label="Filter"
          min={20}
          max={20000}
          value={filterCutoff}
          onChange={handleFilterCutoff}
          formatValue={formatHz}
          dataTestid="knob-filter-cutoff"
        />
        <Knob
          label="Spread"
          min={0}
          max={1}
          value={voiceSpread}
          onChange={handleVoiceSpread}
          dataTestid="knob-voice-spread"
        />
        <Knob
          label="Volume"
          min={-60}
          max={0}
          value={volume}
          onChange={handleVolume}
          formatValue={(v) => `${Math.round(v)}dB`}
          dataTestid="knob-volume"
        />
      </div>
    </div>
  )
}
