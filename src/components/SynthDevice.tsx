import Knob from './Knob'
import type { ToneSynthHook } from '../hooks/useToneSynth'
import {
  SYNTH_FILTER_CUTOFF_DEFAULT_HZ,
  SYNTH_VOICE_SPREAD_DEFAULT,
  SYNTH_VOLUME_DEFAULT_DB,
} from '../audio/parameterDefaults'

interface Props {
  synth: ToneSynthHook
}

export default function SynthDevice({ synth }: Props) {
  const handleToggleEnabled = () => {
    const next = !synth.isEnabled
    synth.setEnabled(next)
  }

  const handleFilterCutoff = (val: number) => {
    synth.setFilterCutoff(val)
  }

  const handleVoiceSpread = (val: number) => {
    synth.setVoiceSpread(val)
  }

  const handleVolume = (val: number) => {
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
      border: '1px solid var(--color-border-strong, var(--color-border, #3a3a48))',
      borderRadius: 'var(--radius-md, 4px)',
      background: 'linear-gradient(180deg, #353544 0%, var(--color-surface-raised, #2e2e38) 100%)',
      boxSizing: 'border-box',
      boxShadow: 'var(--shadow-soft, 0 6px 16px rgba(0, 0, 0, 0.2)), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="device-enable-toggle"
          aria-pressed={synth.isEnabled}
          onClick={handleToggleEnabled}
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            border: '1px solid #555',
            background: synth.isEnabled ? 'var(--color-accent, #f5a623)' : '#333',
            cursor: 'pointer',
            padding: 0,
          }}
          title={synth.isEnabled ? 'Disable synth' : 'Enable synth'}
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
          value={synth.filterCutoff}
          onChange={handleFilterCutoff}
          resetValue={SYNTH_FILTER_CUTOFF_DEFAULT_HZ}
          formatValue={formatHz}
          dataTestid="knob-filter-cutoff"
        />
        <Knob
          label="Spread"
          min={0}
          max={1}
          value={synth.voiceSpread}
          onChange={handleVoiceSpread}
          resetValue={SYNTH_VOICE_SPREAD_DEFAULT}
          dataTestid="knob-voice-spread"
        />
        <Knob
          label="Volume"
          min={-60}
          max={6}
          value={synth.volume}
          onChange={handleVolume}
          resetValue={SYNTH_VOLUME_DEFAULT_DB}
          formatValue={(v) => (isFinite(v) ? `${Math.round(v)}dB` : '-∞dB')}
          dataTestid="knob-volume"
        />
      </div>
    </div>
  )
}
