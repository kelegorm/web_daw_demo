import { useRef, useEffect, useState } from 'react'
import * as Tone from 'tone'
import VUMeter from './VUMeter'
import TimelineRuler from './TimelineRuler'
import { clipDurationSeconds, getPixelsPerSecond } from '../utils/timelineScale'

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
  loop?: boolean
  isTrackMuted?: boolean
  onMuteToggle?: (muted: boolean) => void
  getAnalyserNodeL?: () => AnalyserNode | null
  getAnalyserNodeR?: () => AnalyserNode | null
  onVolumeChange?: (db: number) => void
  getMasterAnalyserNodeL?: () => AnalyserNode | null
  getMasterAnalyserNodeR?: () => AnalyserNode | null
  onMasterVolumeChange?: (db: number) => void
}

export default function TrackZone({ isPlaying, bpm, loop = false, isTrackMuted = false, onMuteToggle, getAnalyserNodeL, getAnalyserNodeR, onVolumeChange, getMasterAnalyserNodeL, getMasterAnalyserNodeR, onMasterVolumeChange }: Props) {
  const [rec, setRec] = useState(true)
  const [volumeDb, setVolumeDb] = useState(0)
  const [masterVolumeDb, setMasterVolumeDb] = useState(0)
  const [playheadPos, setPlayheadPos] = useState(0)

  const rafRef = useRef<number | null>(null)
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm
  const loopRef = useRef(loop)
  loopRef.current = loop

  const clipWidth = clipDurationSeconds(bpm, SEQUENCE_NOTES.length) * getPixelsPerSecond(bpm)

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        const seconds = Tone.getTransport().seconds
        const pps = getPixelsPerSecond(bpmRef.current)
        let px = seconds * pps
        if (loopRef.current) {
          const loopEndPx = clipDurationSeconds(bpmRef.current, SEQUENCE_NOTES.length) * pps
          if (loopEndPx > 0) {
            px = px % loopEndPx
          }
        }
        setPlayheadPos(px)
        rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      setPlayheadPos(0)
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [isPlaying])

  const pitchRange = MAX_PITCH - MIN_PITCH

  return (
    <div
      className="track-zone"
      style={{
        marginTop: 'var(--toolbar-height)',
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        background: 'var(--color-bg)',
        boxSizing: 'border-box',
      }}
    >
      <TimelineRuler bpm={bpm} />
      <div
        className="track-list"
        style={{
          flex: 1,
          overflowY: 'auto',
        }}
      >
      <div
        className="track-row"
        style={{
          height: 80,
          flexShrink: 0,
          display: 'flex',
          width: '100%',
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
          flexDirection: 'row',
          alignItems: 'stretch',
          padding: '6px var(--space-2)',
          gap: 'var(--space-2)',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div
          className="track-header-main"
          style={{
            minWidth: 0,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 'var(--space-1)',
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
            <span
              className="track-name"
              style={{
                color: 'var(--color-text)',
                fontSize: 'calc(var(--font-size-sm) + 0.1rem)',
                fontWeight: 'bold',
                flex: 1,
                minWidth: 0,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              SYNTH1
            </span>
            <button
              className="track-mute"
              aria-pressed={isTrackMuted}
              onClick={() => onMuteToggle?.(!isTrackMuted)}
              style={{
                width: 28,
                height: 22,
                padding: 0,
                fontSize: '0.68rem',
                fontWeight: 700,
                lineHeight: 1,
                background: isTrackMuted ? 'var(--color-accent-dim)' : '#303041',
                color: 'var(--color-text)',
                border: '1px solid #4a4a60',
                borderRadius: 4,
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
                width: 28,
                height: 22,
                padding: 0,
                fontSize: '0.68rem',
                fontWeight: 700,
                lineHeight: 1,
                background: rec ? 'var(--color-danger)' : '#303041',
                color: '#fff',
                border: '1px solid #4a4a60',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              R
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
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
              style={{ flex: 1, minWidth: 0, accentColor: 'var(--color-accent)' }}
            />
            <span
              className="track-volume-label"
              style={{
                color: 'var(--color-text-muted, var(--color-text))',
                fontSize: 'var(--font-size-xs)',
                minWidth: 34,
                flexShrink: 0,
                textAlign: 'right',
                lineHeight: 1,
              }}
            >
              {formatDB(volumeDb)}
            </span>
          </div>
        </div>
        {getAnalyserNodeL && getAnalyserNodeR && (
          <div style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'stretch' }}>
            <VUMeter getAnalyserNodeL={getAnalyserNodeL} getAnalyserNodeR={getAnalyserNodeR} muted={isTrackMuted} />
          </div>
        )}
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
            left: 0,
            width: clipWidth,
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
        </div>
        <div
          className="playhead"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 2,
            background: 'rgba(255, 255, 255, 0.8)',
            left: `${playheadPos}px`,
            pointerEvents: 'none',
          }}
        />
      </div>
      </div>
      </div>
      <div
        className="master-track"
        style={{
          height: 80,
          flexShrink: 0,
          display: 'flex',
          width: '100%',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="master-track-header"
          style={{
            width: 'var(--track-header-width)',
            flexShrink: 0,
            background: 'var(--color-surface)',
            borderRight: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            padding: '6px var(--space-2)',
            gap: 'var(--space-2)',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              minWidth: 0,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 'var(--space-1)',
            }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
              <span
                className="master-track-name"
                style={{
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'bold',
                  flex: 1,
                  minWidth: 0,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                MASTER
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
              <input
                type="range"
                className="master-volume"
                min={0}
                max={100}
                step={0.1}
                value={dbToPos(masterVolumeDb)}
                onChange={(e) => {
                  const db = posToDB(Number(e.target.value))
                  setMasterVolumeDb(db)
                  onMasterVolumeChange?.(db)
                }}
                style={{ flex: 1, minWidth: 0, accentColor: 'var(--color-accent)' }}
              />
              <span
                className="master-volume-label"
                style={{
                  color: 'var(--color-text-muted, var(--color-text))',
                  fontSize: 'var(--font-size-xs)',
                  minWidth: 34,
                  flexShrink: 0,
                  textAlign: 'right',
                  lineHeight: 1,
                }}
              >
                {formatDB(masterVolumeDb)}
              </span>
            </div>
          </div>
          {getMasterAnalyserNodeL && getMasterAnalyserNodeR && (
            <div style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'stretch' }}>
              <VUMeter getAnalyserNodeL={getMasterAnalyserNodeL} getAnalyserNodeR={getMasterAnalyserNodeR} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
