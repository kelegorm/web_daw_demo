interface Props {
  isPlaying: boolean
  onPlay: () => void
  onStop: () => void
  onPanic: () => void
  bpm: number
  onBpmChange: (bpm: number) => void
  loop: boolean
  onLoopToggle: () => void
}

export default function Toolbar({
  isPlaying,
  onPlay,
  onStop,
  onPanic,
  bpm,
  onBpmChange,
  loop,
  onLoopToggle,
}: Props) {
  return (
    <div
      className="toolbar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--toolbar-height)',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-4)',
        zIndex: 100,
        boxSizing: 'border-box',
      }}
    >
      <span
        className="toolbar-app-name"
        style={{
          color: 'var(--color-accent)',
          fontWeight: 'bold',
          fontSize: 'var(--font-size-lg)',
          flexShrink: 0,
        }}
      >
        SynthDemo
      </span>

      <div
        className="toolbar-transport"
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          alignItems: 'center',
          marginLeft: 32,
          flexShrink: 0,
        }}
      >
        <button
          className="toolbar-play-pause"
          onClick={onPlay}
          aria-pressed={isPlaying}
          style={{
            padding: '4px 16px',
            background: isPlaying ? 'var(--color-surface-raised)' : 'var(--color-success)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          className="toolbar-stop"
          onClick={onStop}
          style={{
            padding: '4px 12px',
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          Stop
        </button>
        <button
          className="toolbar-loop"
          onClick={onLoopToggle}
          aria-pressed={loop}
          style={{
            padding: '4px 10px',
            background: loop ? 'var(--color-accent-dim)' : 'var(--color-surface-raised)',
            color: loop ? '#fff' : 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          Loop
        </button>
        <button
          className="toolbar-panic"
          onClick={onPanic}
          style={{
            padding: '4px 12px',
            background: 'var(--color-danger)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          Panic
        </button>
        <label
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
          }}
        >
          BPM
          <input
            type="number"
            className="toolbar-bpm"
            min={60}
            max={200}
            value={bpm}
            onChange={(e) => {
              const v = Math.min(200, Math.max(60, Number(e.target.value)))
              onBpmChange(v)
            }}
            style={{
              width: 52,
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px var(--space-1)',
              fontSize: 'var(--font-size-sm)',
            }}
          />
        </label>
      </div>
    </div>
  )
}
