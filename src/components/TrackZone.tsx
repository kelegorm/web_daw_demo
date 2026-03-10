import { useRef, useEffect, useState } from 'react'
import * as Tone from 'tone'
import VUMeter from './VUMeter'
import TimelineRuler from './TimelineRuler'
import { clipDurationSeconds, getPixelsPerSecond } from '../utils/timelineScale'
import { useTrackSelectionContext } from '../hooks/useTrackSelection'
import {
  AUDIO_DB_MAX,
  AUDIO_DB_MIN,
  MASTER_VOLUME_DEFAULT_DB,
  TRACK_VOLUME_DEFAULT_DB,
} from '../audio/parameterDefaults'

const SEQUENCE_NOTES = [60, 62, 64, 65, 67, 69, 71, 72]
const MIN_PITCH = 60
const MAX_PITCH = 72

const FADER_MIN_DB = AUDIO_DB_MIN
const FADER_MAX_DB = AUDIO_DB_MAX
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
  playbackState: 'playing' | 'paused' | 'stopped'
  bpm: number
  loop?: boolean
  isTrackMuted?: boolean
  isTrackRecEnabled?: boolean
  onMuteToggle?: (muted: boolean) => void
  onRecToggle?: (recEnabled: boolean) => void
  getAnalyserNodeL?: () => AnalyserNode | null
  getAnalyserNodeR?: () => AnalyserNode | null
  trackVolumeDb?: number
  onVolumeChange?: (db: number) => void
  getMasterAnalyserNodeL?: () => AnalyserNode | null
  getMasterAnalyserNodeR?: () => AnalyserNode | null
  masterVolumeDb?: number
  onMasterVolumeChange?: (db: number) => void
}

export default function TrackZone({
  playbackState,
  bpm,
  loop = false,
  isTrackMuted = false,
  isTrackRecEnabled = true,
  onMuteToggle,
  onRecToggle,
  getAnalyserNodeL,
  getAnalyserNodeR,
  trackVolumeDb = 0,
  onVolumeChange,
  getMasterAnalyserNodeL,
  getMasterAnalyserNodeR,
  masterVolumeDb = 0,
  onMasterVolumeChange,
}: Props) {
  const [playheadPos, setPlayheadPos] = useState(0)
  const { selectedTrack, selectTrack } = useTrackSelectionContext()

  const rafRef = useRef<number | null>(null)

  const clipWidth = clipDurationSeconds(bpm, SEQUENCE_NOTES.length) * getPixelsPerSecond(bpm)

  useEffect(() => {
    const getPlayheadPx = () => {
      if (playbackState === 'stopped') {
        return 0
      }

      const seconds = Tone.getTransport().seconds
      const pps = getPixelsPerSecond(bpm)
      let px = seconds * pps

      if (loop) {
        const loopEndPx = clipWidth
        if (loopEndPx > 0) {
          px = px % loopEndPx
        }
      }

      return px
    }

    if (playbackState === 'playing') {
      const animate = () => {
        setPlayheadPos(getPlayheadPx())
        rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      setPlayheadPos(getPlayheadPx())
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [playbackState, bpm, loop, clipWidth])

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
      <TimelineRuler bpm={bpm} loop={loop} loopRegionWidth={clipWidth} />
      <div
        className="track-list"
        style={{
          flex: 1,
          position: 'relative',
          overflowY: 'auto',
          background: 'var(--color-track-content-bg, var(--color-bg))',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.025)',
        }}
      >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 'var(--track-header-width)',
          width: 1,
          background: 'var(--color-track-divider, #5d5d76)',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />
      <div
        className="track-row"
        data-selected={selectedTrack === 'synth1' ? 'true' : 'false'}
        onClick={() => selectTrack('synth1')}
        style={{
          height: 80,
          flexShrink: 0,
          display: 'flex',
          width: '100%',
          borderBottom: '1px solid var(--color-border)',
          boxSizing: 'border-box',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03), inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
          borderLeft: selectedTrack === 'synth1' ? '3px solid var(--color-accent)' : '3px solid transparent',
          background: selectedTrack === 'synth1' ? 'rgba(255,255,255,0.03)' : undefined,
          cursor: 'pointer',
        }}
      >
        <div
        className="track-header"
        style={{
          width: 'var(--track-header-width)',
          flexShrink: 0,
          background: 'var(--color-track-header-bg, var(--color-surface))',
          borderRight: '1px solid #5d5d76',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          padding: '6px var(--space-2)',
          gap: 'var(--space-2)',
          boxSizing: 'border-box',
          overflow: 'hidden',
          boxShadow: '0 3px 7px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(0,0,0,0.35)',
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
                fontFamily: "'Courier New', Courier, monospace",
                flex: 1,
                minWidth: 0,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              synth1
            </span>
            <div
              style={{
                display: 'flex',
                gap: 4,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  padding: 1,
                  borderRadius: 6,
                  background: 'linear-gradient(180deg, #1a1a22 0%, #15151c 100%)',
                  border: '1px solid rgba(0,0,0,0.45)',
                  boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(255,255,255,0.03)',
                }}
              >
                <button
                  className="track-mute"
                  aria-pressed={isTrackMuted}
                  onClick={() => onMuteToggle?.(!isTrackMuted)}
                  style={{
                    width: 26,
                    height: 26,
                    padding: 0,
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    lineHeight: 1,
                    letterSpacing: 0.3,
                    background: isTrackMuted
                      ? 'linear-gradient(180deg, #b27512 0%, #a76c10 52%, #9f660f 100%)'
                      : 'linear-gradient(180deg, #3c3c4e 0%, #353546 52%, #313142 100%)',
                    color: isTrackMuted ? '#fff7e8' : '#e1e6f4',
                    border: '1px solid',
                    borderColor: isTrackMuted ? '#e1b56f #b8822f #6f4307 #bf892b' : '#9090ac #64647c #343447 #6c6c87',
                    borderRadius: 4,
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.3)',
                    textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                  }}
                >
                  M
                </button>
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  padding: 1,
                  borderRadius: 6,
                  background: 'linear-gradient(180deg, #1a1a22 0%, #15151c 100%)',
                  border: '1px solid rgba(0,0,0,0.45)',
                  boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(255,255,255,0.03)',
                }}
              >
                <button
                  className="track-rec"
                  aria-pressed={isTrackRecEnabled}
                  onClick={() => onRecToggle?.(!isTrackRecEnabled)}
                  style={{
                    width: 26,
                    height: 26,
                    padding: 0,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    lineHeight: 1,
                    background: isTrackRecEnabled
                      ? 'linear-gradient(180deg, #df4747 0%, #d13d3d 52%, #c53a3a 100%)'
                      : 'linear-gradient(180deg, #3c3c4e 0%, #353546 52%, #313142 100%)',
                    color: isTrackRecEnabled ? '#fff3f3' : '#e1e6f4',
                    border: '1px solid',
                    borderColor: isTrackRecEnabled ? '#ff9a9a #dd5a5a #7f1f1f #e26363' : '#9090ac #64647c #343447 #6c6c87',
                    borderRadius: 4,
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.3)',
                    textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                  }}
                >
                  ●
                </button>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
            <input
              type="range"
              className="track-volume"
              min={0}
              max={100}
              step={0.1}
              value={dbToPos(trackVolumeDb)}
              onChange={(e) => {
                const db = posToDB(Number(e.target.value))
                onVolumeChange?.(db)
              }}
              onDoubleClick={() => onVolumeChange?.(TRACK_VOLUME_DEFAULT_DB)}
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
              {formatDB(trackVolumeDb)}
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
          background: 'var(--color-track-content-bg, var(--color-bg))',
          boxShadow: 'inset 1px 0 0 rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.015)',
        }}
      >
        {loop && (
          <div
            className="timeline-loop-region-track"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: clipWidth,
              border: '1px dashed rgba(65, 180, 120, 0.65)',
              boxSizing: 'border-box',
            background: 'rgba(65, 180, 120, 0.08)',
            boxShadow: 'inset 0 0 0 1px rgba(65, 180, 120, 0.08)',
            pointerEvents: 'none',
          }}
          />
        )}
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
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 6px rgba(0, 0, 0, 0.24)',
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
        data-selected={selectedTrack === 'master' ? 'true' : 'false'}
        onClick={() => selectTrack('master')}
        style={{
          height: 80,
          flexShrink: 0,
          display: 'flex',
          width: '100%',
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          background: selectedTrack === 'master' ? 'rgba(255,255,255,0.03)' : 'var(--color-track-content-bg, var(--color-bg))',
          boxSizing: 'border-box',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03), inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
          borderLeft: selectedTrack === 'master' ? '3px solid var(--color-accent)' : '3px solid transparent',
          cursor: 'pointer',
        }}
      >
        <div
          className="master-track-header"
          style={{
            width: 'var(--track-header-width)',
            flexShrink: 0,
            background: 'var(--color-track-header-bg, var(--color-surface))',
            borderRight: '1px solid #5d5d76',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            padding: '6px var(--space-2)',
            gap: 'var(--space-2)',
            boxSizing: 'border-box',
            overflow: 'hidden',
            boxShadow: '0 3px 7px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(0,0,0,0.35)',
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
                  fontFamily: "'Courier New', Courier, monospace",
                  flex: 1,
                  minWidth: 0,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Master
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
                  onMasterVolumeChange?.(db)
                }}
                onDoubleClick={() => onMasterVolumeChange?.(MASTER_VOLUME_DEFAULT_DB)}
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
        <div
          className="master-track-content"
          style={{
            flex: 1,
            background: 'var(--color-track-content-bg, var(--color-bg))',
            boxShadow: 'inset 1px 0 0 rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.015)',
          }}
        />
      </div>
    </div>
  )
}
