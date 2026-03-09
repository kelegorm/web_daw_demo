import SynthDevice from './SynthDevice'
import PannerDevice from './PannerDevice'
import type { ToneSynthHook } from '../hooks/useToneSynth'
import type { PannerHook } from '../hooks/usePanner'

interface Props {
  synth: ToneSynthHook
  panner: PannerHook
}

export default function DevicePanel({ synth, panner }: Props) {
  return (
    <div
      className="device-panel"
      style={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: 140,
        background: 'var(--color-surface, #26262e)',
        borderTop: '1px solid #333',
        borderBottom: '1px solid #333',
      }}
    >
      <SynthDevice synth={synth} />
      <div style={{ width: 1, background: '#444', flexShrink: 0 }} />
      <PannerDevice panner={panner} />
    </div>
  )
}
