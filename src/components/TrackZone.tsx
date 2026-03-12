import { useRef, useEffect, useState } from 'react'
import VUMeter from './VUMeter'
import TimelineRuler from './TimelineRuler'
import { beatDurationSeconds, getPixelsPerSecond } from '../utils/timelineScale'
import {
  AUDIO_DB_MAX,
  AUDIO_DB_MIN,
  MASTER_VOLUME_DEFAULT_DB,
  TRACK_VOLUME_DEFAULT_DB,
} from '../audio/parameterDefaults'
import { getMidiClipLengthBeats } from '../project-runtime/midiClipStore'
import type { MeterSource } from '../engine/types'
import type { PlaybackState } from '../hooks/useTransportController'
import type { UiRuntimeClipModel } from '../ui-plan/buildUiRuntime'

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
  model: TrackZoneModel
  actions: TrackZoneActions
}

interface TrackZoneTrackViewModel {
  trackId: string
  displayName: string
  clips: UiRuntimeClipModel[]
  meterSource?: MeterSource | null
  volumeDb: number
  isMuted: boolean
  isRecEnabled: boolean
}

interface TrackZoneMasterTrackViewModel {
  trackId: string
  displayName: string
  meterSource?: MeterSource | null
  volumeDb: number
}

export interface TrackZoneModel {
  playbackState: PlaybackState
  bpm: number
  loop: boolean
  selectedTrackId: string
  tracks: TrackZoneTrackViewModel[]
  masterTrack: TrackZoneMasterTrackViewModel
  getPositionSeconds?: () => number
}

export interface TrackZoneActions {
  selectTrack(trackId: string): void
  setTrackMute(trackId: string, muted: boolean): void
  setTrackRecEnabled(trackId: string, recEnabled: boolean): void
  setTrackVolume(trackId: string, db: number): void
  setMasterVolume(db: number): void
}

interface ClipLayout {
  clipId: string
  lengthSteps: number
  clipSteps: UiRuntimeClipModel['clip']['steps']
  minPitch: number
  pitchRange: number
  clipStartPx: number
  clipWidth: number
}

function resolveClipLayout(clipModel: UiRuntimeClipModel | undefined, bpm: number): ClipLayout | null {
  if (!clipModel) {
    return null
  }

  const clip = clipModel.clip
  if (clip.steps.length < clip.lengthSteps) {
    throw new Error(
      `MIDI clip "${clip.clipId}" has ${clip.steps.length} steps, expected at least ${clip.lengthSteps}`,
    )
  }

  const clipSteps = clip.steps.slice(0, clip.lengthSteps)
  const noteValues = clipSteps.filter((step) => step.enabled).map((step) => step.note)
  const minPitch = noteValues.length > 0 ? Math.min(...noteValues) : 60
  const maxPitch = noteValues.length > 0 ? Math.max(...noteValues) : 72
  const pitchRange = Math.max(maxPitch - minPitch, 1)

  const pps = getPixelsPerSecond(bpm)
  const clipStartSeconds = clip.startBeat * beatDurationSeconds(bpm)
  const clipLengthSeconds = getMidiClipLengthBeats(clip) * beatDurationSeconds(bpm)

  return {
    clipId: clip.clipId,
    lengthSteps: clip.lengthSteps,
    clipSteps,
    minPitch,
    pitchRange,
    clipStartPx: clipStartSeconds * pps,
    clipWidth: clipLengthSeconds * pps,
  }
}

function resolvePrimaryClipLayout(model: TrackZoneModel): ClipLayout {
  const selectedTrack = model.tracks.find((track) => track.trackId === model.selectedTrackId)
  const fallbackTrack = model.tracks[0]
  const primaryTrack = selectedTrack ?? fallbackTrack
  const primaryClipLayout = resolveClipLayout(primaryTrack?.clips[0], model.bpm)

  if (!primaryClipLayout) {
    return {
      clipId: 'no-clip',
      lengthSteps: 1,
      clipSteps: [],
      minPitch: 60,
      pitchRange: 1,
      clipStartPx: 0,
      clipWidth: 0,
    }
  }

  return primaryClipLayout
}

export default function TrackZone({ model, actions }: Props) {
  const [playheadPos, setPlayheadPos] = useState(0)
  const rafRef = useRef<number | null>(null)
  const primaryClip = resolvePrimaryClipLayout(model)
  const pps = getPixelsPerSecond(model.bpm)

  useEffect(() => {
    const getPlayheadPx = () => {
      if (model.playbackState === 'stopped') {
        return 0
      }

      const seconds = model.getPositionSeconds ? model.getPositionSeconds() : 0
      let px = seconds * pps

      if (model.loop && primaryClip.clipWidth > 0 && px >= primaryClip.clipStartPx) {
        const loopWindowOffsetPx = px - primaryClip.clipStartPx
        if (loopWindowOffsetPx >= 0) {
          px = primaryClip.clipStartPx + (loopWindowOffsetPx % primaryClip.clipWidth)
        }
      }

      return px
    }

    if (model.playbackState === 'playing') {
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
  }, [model.playbackState, model.loop, primaryClip.clipStartPx, primaryClip.clipWidth, model.getPositionSeconds, pps])

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
      <TimelineRuler
        bpm={model.bpm}
        loop={model.loop}
        loopRegionLeft={primaryClip.clipStartPx}
        loopRegionWidth={primaryClip.clipWidth}
      />
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
        {model.tracks.map((track) => {
          const selected = model.selectedTrackId === track.trackId
          const clipLayout = resolveClipLayout(track.clips[0], model.bpm)

          return (
            <div
              key={track.trackId}
              className="track-row"
              data-track-id={track.trackId}
              data-selected={selected ? 'true' : 'false'}
              onClick={() => actions.selectTrack(track.trackId)}
              style={{
                height: 80,
                flexShrink: 0,
                display: 'flex',
                width: '100%',
                borderBottom: '1px solid var(--color-border)',
                boxSizing: 'border-box',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03), inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
                borderLeft: selected ? '3px solid var(--color-accent)' : '3px solid transparent',
                background: selected ? 'rgba(255,255,255,0.03)' : undefined,
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
                  boxShadow:
                    '0 3px 7px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(0,0,0,0.35)',
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
                      {track.displayName}
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
                          aria-pressed={track.isMuted}
                          onClick={() => actions.setTrackMute(track.trackId, !track.isMuted)}
                          style={{
                            width: 26,
                            height: 26,
                            padding: 0,
                            fontSize: '0.64rem',
                            fontWeight: 700,
                            lineHeight: 1,
                            letterSpacing: 0.3,
                            background: track.isMuted
                              ? 'linear-gradient(180deg, #b27512 0%, #a76c10 52%, #9f660f 100%)'
                              : 'linear-gradient(180deg, #3c3c4e 0%, #353546 52%, #313142 100%)',
                            color: track.isMuted ? '#fff7e8' : '#e1e6f4',
                            border: '1px solid',
                            borderColor: track.isMuted ? '#e1b56f #b8822f #6f4307 #bf892b' : '#9090ac #64647c #343447 #6c6c87',
                            borderRadius: 4,
                            cursor: 'pointer',
                            boxShadow:
                              '0 1px 3px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.3)',
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
                          aria-pressed={track.isRecEnabled}
                          onClick={() => actions.setTrackRecEnabled(track.trackId, !track.isRecEnabled)}
                          style={{
                            width: 26,
                            height: 26,
                            padding: 0,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            lineHeight: 1,
                            background: track.isRecEnabled
                              ? 'linear-gradient(180deg, #df4747 0%, #d13d3d 52%, #c53a3a 100%)'
                              : 'linear-gradient(180deg, #3c3c4e 0%, #353546 52%, #313142 100%)',
                            color: track.isRecEnabled ? '#fff3f3' : '#e1e6f4',
                            border: '1px solid',
                            borderColor: track.isRecEnabled ? '#ff9a9a #dd5a5a #7f1f1f #e26363' : '#9090ac #64647c #343447 #6c6c87',
                            borderRadius: 4,
                            cursor: 'pointer',
                            boxShadow:
                              '0 1px 3px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.3)',
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
                      value={dbToPos(track.volumeDb)}
                      onChange={(e) => {
                        const db = posToDB(Number(e.target.value))
                        actions.setTrackVolume(track.trackId, db)
                      }}
                      onDoubleClick={() => actions.setTrackVolume(track.trackId, TRACK_VOLUME_DEFAULT_DB)}
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
                      {formatDB(track.volumeDb)}
                    </span>
                  </div>
                </div>
                {track.meterSource && (
                  <div style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'stretch' }}>
                    <VUMeter meterSource={track.meterSource} />
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
                {model.loop && clipLayout && (
                  <div
                    className="timeline-loop-region-track"
                    style={{
                      position: 'absolute',
                      left: clipLayout.clipStartPx,
                      top: 0,
                      bottom: 0,
                      width: clipLayout.clipWidth,
                      border: '1px dashed rgba(65, 180, 120, 0.65)',
                      boxSizing: 'border-box',
                      background: 'rgba(65, 180, 120, 0.08)',
                      boxShadow: 'inset 0 0 0 1px rgba(65, 180, 120, 0.08)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
                {clipLayout && (
                  <div
                    className="midi-clip"
                    data-clip-id={clipLayout.clipId}
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: clipLayout.clipStartPx,
                      width: clipLayout.clipWidth,
                      bottom: 8,
                      background: '#1e3a5f',
                      border: '1px solid #3a6090',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 2px 6px rgba(0, 0, 0, 0.24)',
                    }}
                  >
                    {clipLayout.clipSteps.map((step, i) => {
                      if (!step.enabled) return null
                      const x = (i / clipLayout.lengthSteps) * 100
                      const y = 100 - ((step.note - clipLayout.minPitch) / clipLayout.pitchRange) * 100
                      return (
                        <div
                          className="midi-clip-note"
                          key={`${i}-${step.note}`}
                          style={{
                            position: 'absolute',
                            left: `${x}%`,
                            top: `${Math.min(y, 90)}%`,
                            width: `${100 / clipLayout.lengthSteps - 1}%`,
                            height: 5,
                            background: 'var(--color-accent)',
                            borderRadius: 1,
                          }}
                        />
                      )
                    })}
                  </div>
                )}
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
          )
        })}
      </div>
      {/* TODO(ui-plan): Keep master-row special-casing in TrackZone temporary until master-track unification is implemented. */}
      <div
        className="master-track"
        data-track-id={model.masterTrack.trackId}
        data-selected={model.selectedTrackId === model.masterTrack.trackId ? 'true' : 'false'}
        onClick={() => actions.selectTrack(model.masterTrack.trackId)}
        style={{
          height: 80,
          flexShrink: 0,
          display: 'flex',
          width: '100%',
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          background:
            model.selectedTrackId === model.masterTrack.trackId
              ? 'rgba(255,255,255,0.03)'
              : 'var(--color-track-content-bg, var(--color-bg))',
          boxSizing: 'border-box',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03), inset 0 -1px 0 rgba(0, 0, 0, 0.3)',
          borderLeft:
            model.selectedTrackId === model.masterTrack.trackId
              ? '3px solid var(--color-accent)'
              : '3px solid transparent',
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
                {model.masterTrack.displayName}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
              <input
                type="range"
                className="master-volume"
                min={0}
                max={100}
                step={0.1}
                value={dbToPos(model.masterTrack.volumeDb)}
                onChange={(e) => {
                  const db = posToDB(Number(e.target.value))
                  actions.setMasterVolume(db)
                }}
                onDoubleClick={() => actions.setMasterVolume(MASTER_VOLUME_DEFAULT_DB)}
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
                {formatDB(model.masterTrack.volumeDb)}
              </span>
            </div>
          </div>
          {model.masterTrack.meterSource && (
            <div style={{ width: 16, flexShrink: 0, display: 'flex', alignItems: 'stretch' }}>
              <VUMeter meterSource={model.masterTrack.meterSource} />
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
