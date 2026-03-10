import { useState } from 'react'
import Knob from './Knob'
import {
  SYNTH_FILTER_CUTOFF_DEFAULT_HZ,
  SYNTH_VOICE_SPREAD_DEFAULT,
} from '../audio/parameterDefaults'

interface Props {
  setParam: (name: string, value: number) => void
}

export default function ParameterPanel({ setParam }: Props) {
  const [filterCutoff, setFilterCutoff] = useState(SYNTH_FILTER_CUTOFF_DEFAULT_HZ)
  const [voiceSpread, setVoiceSpread] = useState(SYNTH_VOICE_SPREAD_DEFAULT)
  const [reverbMix, setReverbMix] = useState(0)

  const handleFilterCutoff = (v: number) => {
    setFilterCutoff(v)
    setParam('filterCutoff', v)
  }

  const handleVoiceSpread = (v: number) => {
    setVoiceSpread(v)
    setParam('voiceSpread', v)
  }

  const handleReverbMix = (v: number) => {
    setReverbMix(v)
    setParam('reverbMix', v)
  }

  return (
    <div
      className="parameter-panel"
      style={{ display: 'flex', gap: 32, alignItems: 'flex-start', padding: '12px 0' }}
    >
      <Knob
        label="Filter Cutoff"
        min={20}
        max={20000}
        value={filterCutoff}
        onChange={handleFilterCutoff}
        resetValue={SYNTH_FILTER_CUTOFF_DEFAULT_HZ}
        formatValue={(v) => `${Math.round(v)} Hz`}
        dataTestid="knob-filter-cutoff"
      />
      <Knob
        label="Voice Spread"
        min={0}
        max={1}
        value={voiceSpread}
        onChange={handleVoiceSpread}
        resetValue={SYNTH_VOICE_SPREAD_DEFAULT}
        dataTestid="knob-voice-spread"
      />
      <Knob
        label="Reverb Mix"
        min={0}
        max={1}
        value={reverbMix}
        onChange={handleReverbMix}
        resetValue={0}
        dataTestid="knob-reverb-mix"
      />
    </div>
  )
}
