interface Props {
  isPlaying: boolean
  onTogglePlay: () => void
  onPanic: () => void
}

export default function Transport({ isPlaying, onTogglePlay, onPanic }: Props) {
  return (
    <div className="transport" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <button
        className="transport-play-pause"
        onClick={onTogglePlay}
        style={{
          padding: '8px 20px',
          fontSize: 16,
          cursor: 'pointer',
          background: isPlaying ? '#555' : '#2a7',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
        }}
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button
        className="transport-panic"
        onClick={onPanic}
        style={{
          padding: '8px 16px',
          fontSize: 16,
          cursor: 'pointer',
          background: '#c33',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
        }}
      >
        Panic
      </button>
    </div>
  )
}
