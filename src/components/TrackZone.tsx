import { useRef, useEffect, useState } from 'react'
import VUMeter from './VUMeter'

const SEQUENCE_NOTES = [60, 62, 64, 65, 67, 69, 71, 72]
const MIN_PITCH = 60
const MAX_PITCH = 72

const FADER_MIN_DB = -60
const FADER_MAX_DB = 6
const FADER_SNAP_THRESHOLD = 10 // leftmost 10% of slider (0-100 range) snaps to -Infinity

function posToDB(pos: number): number {
  if (pos <= FADER_SNAP_THRESHOLD) return -Infinity
  const normalized = (pos - FADER_SNAP_THRESHOLD) / (100 - FADER_SNAP_THRESHOLD)
  return FADER_MIN_DB + normalized * (FADER_MAX_DB - FADER_MIN_DB)
}

function dbToPos(db: number): number {
  if (!isFinite(db) || db <= FADER_MIN_DB) return 0
  const normalized = (db - FADER_MIN_DB) / (FADER_MAX_DB - FADER_MIN_DB)
  return FADER_SNAP_THRESHOLD + normalized * (100 - FADER_SNAP_THRESHOLD)
}

function formatDB(db: number): string {
  if (!isFinite(db)) return '-\u221e'
  const rounded = Math.round(db * 10) / 10
  return rounded >= 0 ? `+${rounded}` : `${rounded}`
}

interface Props {
  isPlaying: boolean
  bpm: number
  isTrackMuted?: boolean
  onMuteToggle?: (muted: boolean) => void
  getAnalyserNode?: () => AnalyserNode | null
  onVolumeChange?: (db: number) => void
}

export default function TrackZone({ isPlaying, bpm, isTrackMuted = false, onMuteToggle, getAnalyserNode, onVolumeChange }: Props) {
  const [rec, setRec] = useState(true)
  const [volumeDb, setVolumeDb] = useState(0)
  const [playheadPos, setPlayheadPos] = useState(0)

  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const stepDuration = (60 / bpm) * 1000
  const totalDuration = stepDuration * SEQUENCE_NOTES.length

  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = performance.now()
      const animate = () => {
        if (startTimeRef.current === null) return
        const elapsed = performance.now() - startTimeRef.current
        const pos = (elapsed % totalDuration) / totalDuration
        setPlayheadPos(pos)
        rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      startTimeRef.current = null
      setPlayheadPos(0)
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying, totalDuration])

  const pitchRange = MAX_PITCH - MIN_PITCH

  return (
    <div
      className="track-zone"
      style={{
        marginTop: 'var(--toolbar-height)',
        display: 'flex',
        width: '100%',
        height: 80,
        background: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="track-header"
        style={{
          width: 'var(--track-header-width)',
          flexShrink: 0,
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          padding: 'var(--space-2)',
          gap: 'var(--space-1)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
          <span
            className="track-name"
            style={{
              color: 'var(--color-text)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'bold',
              flex: 1,
            }}
          >
            synth1
          </span>
          {getAnalyserNode && (
            <VUMeter getAnalyserNode={getAnalyserNode} muted={isTrackMuted} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
          <input
            type="range"
            className="track-volume"
            min={0}
            max={100}
            step={0.1}
            value={dbToPos(volumeDb)}
            onChange={(e) => {
              const db = posToDB(Number(e.target.value))
              setVolumeDb(db)
              onVolumeChange?.(db)
            }}
            style={{ flex: 1, accentColor: 'var(--color-accent)' }}
          />
          <span
            className="track-volume-label"
            style={{
              color: 'var(--color-text-muted, var(--color-text))',
              fontSize: 'var(--font-size-xs)',
              minWidth: 32,
              textAlign: 'right',
            }}
          >
            {formatDB(volumeDb)}
          </span>
          <button
            className="track-mute"
            aria-pressed={isTrackMuted}
            onClick={() => onMuteToggle?.(!isTrackMuted)}
            style={{
              padding: '2px 6px',
              fontSize: 'var(--font-size-xs)',
              background: isTrackMuted ? 'var(--color-accent-dim)' : 'var(--color-surface-raised)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            M
          </button>
          <button
            className="track-rec"
            aria-pressed={rec}
            onClick={() => setRec((r) => !r)}
            style={{
              padding: '2px 6px',
              fontSize: 'var(--font-size-xs)',
              background: rec ? 'var(--color-danger)' : 'var(--color-surface-raised)',
              color: '#fff',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
            }}
          >
            R
          </button>
        </div>
      </div>

      <div
        className="track-timeline"
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--color-bg)',
        }}
      >
        <div
          className="midi-clip"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            width: 240,
            bottom: 8,
            background: '#1e3a5f',
            border: '1px solid #3a6090',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          {SEQUENCE_NOTES.map((note, i) => {
            const x = (i / SEQUENCE_NOTES.length) * 100
            const y = 100 - ((note - MIN_PITCH) / pitchRange) * 100
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${Math.min(y, 90)}%`,
                  width: `${100 / SEQUENCE_NOTES.length - 1}%`,
                  height: 5,
                  background: 'var(--color-accent)',
                  borderRadius: 1,
                }}
              />
            )
          })}
          <div
            className="playhead"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 2,
              background: 'rgba(255, 255, 255, 0.8)',
              left: `${playheadPos * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
