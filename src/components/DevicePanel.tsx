import SynthDevice from './SynthDevice'
import PannerDevice from './PannerDevice'
import type { ToneSynthHook } from '../hooks/useToneSynth'
import type { PannerHook } from '../hooks/usePanner'

interface Props {
  synth: ToneSynthHook
  panner: PannerHook
}

export default function DevicePanel({ synth, panner }: Props) {
  const selectedTrackName = 'synth1'

  return (
    <div
      className="device-panel"
      style={{
        width: '100%',
        height: 'var(--device-panel-height, 140px)',
        background: 'var(--color-bg, #1a1a1f)',
        padding: '8px 10px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="device-panel-frame"
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          background: 'var(--color-surface, #26262e)',
          border: '1px solid var(--color-border, #3a3a48)',
          borderRadius: 'var(--radius-md, 4px)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
          overflow: 'hidden',
        }}
      >
        <div
          className="device-panel-track-strip"
          style={{
            width: 28,
            flexShrink: 0,
            borderRight: '1px solid var(--color-border, #3a3a48)',
            background: 'linear-gradient(180deg, #30303b 0%, #2a2a34 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            className="device-panel-track-name"
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: 'center',
              display: 'inline-block',
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'var(--color-text-muted, #888899)',
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {selectedTrackName}
          </span>
        </div>

        <div
          className="device-panel-content"
          style={{
            display: 'flex',
            flexDirection: 'row',
            flex: 1,
            minWidth: 0,
            alignItems: 'stretch',
            justifyContent: 'flex-start',
            gap: 10,
            padding: 8,
            boxSizing: 'border-box',
            overflowX: 'auto',
          }}
        >
          <SynthDevice synth={synth} />
          <PannerDevice panner={panner} />
        </div>
      </div>
    </div>
  )
}
