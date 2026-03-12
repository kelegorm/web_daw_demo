// @vitest-environment jsdom
import * as React from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TrackZone, { type TrackZoneActions, type TrackZoneModel } from './TrackZone'
import type { UiRuntimeClipModel } from '../ui-plan/buildUiRuntime'
import { STEP_BEATS, type MidiStep } from '../project-runtime/midiClipStore'
import { beatDurationSeconds, getPixelsPerSecond } from '../utils/timelineScale'

vi.mock('./VUMeter', () => ({
  default: () => null,
}))

vi.mock('./TimelineRuler', () => ({
  default: ({
    loopRegionLeft = 0,
    loopRegionWidth = 0,
  }: {
    loopRegionLeft?: number
    loopRegionWidth?: number
  }) => (
    <div
      className="timeline-ruler-mock"
      data-loop-left={String(loopRegionLeft)}
      data-loop-width={String(loopRegionWidth)}
    />
  ),
}))

function makeClipModel({
  clipId = 'clip-test',
  startBeat,
  notes,
  enabledSteps,
}: {
  clipId?: string
  startBeat: number
  notes: number[]
  enabledSteps?: boolean[]
}): UiRuntimeClipModel {
  const steps: MidiStep[] = notes.map((note, index) => ({
    enabled: enabledSteps?.[index] ?? true,
    note,
    velocity: 100,
    gate: 0.8,
  }))

  return {
    clipId,
    clip: {
      clipId,
      startBeat,
      lengthSteps: steps.length,
      steps,
    },
  }
}

function makeNotes(lengthSteps: number): number[] {
  return Array.from({ length: lengthSteps }, (_, index) => 60 + index)
}

function makeActions(overrides: Partial<TrackZoneActions> = {}): TrackZoneActions {
  return {
    selectTrack: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackRecEnabled: vi.fn(),
    setTrackVolume: vi.fn(),
    setMasterVolume: vi.fn(),
    ...overrides,
  }
}

function makeModel(overrides: Partial<TrackZoneModel> = {}): TrackZoneModel {
  const trackId = 'track-1'
  const masterTrackId = 'master-track-1'

  return {
    playbackState: 'stopped',
    bpm: 120,
    loop: true,
    selectedTrackId: trackId,
    tracks: [
      {
        trackId,
        displayName: 'Track 1',
        clips: [makeClipModel({ startBeat: 0, notes: makeNotes(8) })],
        meterSource: null,
        volumeDb: 0,
        isMuted: false,
        isRecEnabled: true,
      },
    ],
    masterTrack: {
      trackId: masterTrackId,
      displayName: 'Master',
      meterSource: null,
      volumeDb: 0,
    },
    ...overrides,
  }
}

describe('TrackZone model-driven layout', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    flushSync(() => {
      root.unmount()
    })
    container.remove()
  })

  it.each([
    { startBeat: 0, lengthSteps: 8 },
    { startBeat: 0.5, lengthSteps: 8 },
    { startBeat: 0, lengthSteps: 7 },
  ])('derives geometry from runtime clip data (startBeat=$startBeat, lengthSteps=$lengthSteps)', ({
    startBeat,
    lengthSteps,
  }) => {
    const clipModel = makeClipModel({
      startBeat,
      notes: makeNotes(lengthSteps),
    })
    const model = makeModel({
      tracks: [
        {
          trackId: 'track-1',
          displayName: 'Track 1',
          clips: [clipModel],
          meterSource: null,
          volumeDb: 0,
          isMuted: false,
          isRecEnabled: true,
        },
      ],
    })
    const bpm = 120
    const pps = getPixelsPerSecond(bpm)
    const expectedLeft = clipModel.clip.startBeat * beatDurationSeconds(bpm) * pps
    const expectedWidth = clipModel.clip.lengthSteps * STEP_BEATS * beatDurationSeconds(bpm) * pps

    flushSync(() => {
      root.render(<TrackZone model={model} actions={makeActions()} />)
    })

    const clip = container.querySelector('.midi-clip') as HTMLElement
    const trackLoopRegion = container.querySelector('.timeline-loop-region-track') as HTMLElement
    const ruler = container.querySelector('.timeline-ruler-mock') as HTMLElement

    expect(clip).toBeTruthy()
    expect(trackLoopRegion).toBeTruthy()
    expect(ruler).toBeTruthy()

    expect(parseFloat(clip.style.left)).toBeCloseTo(expectedLeft, 5)
    expect(parseFloat(trackLoopRegion.style.left)).toBeCloseTo(expectedLeft, 5)
    expect(parseFloat(clip.style.width)).toBeCloseTo(expectedWidth, 5)
    expect(parseFloat(trackLoopRegion.style.width)).toBeCloseTo(expectedWidth, 5)
    expect(Number(ruler.dataset.loopLeft)).toBeCloseTo(expectedLeft, 5)
    expect(Number(ruler.dataset.loopWidth)).toBeCloseTo(expectedWidth, 5)
  })

  it('renders MIDI notes from runtime clip steps instead of local constants', () => {
    const model = makeModel({
      tracks: [
        {
          trackId: 'track-1',
          displayName: 'Track 1',
          clips: [
            makeClipModel({
              startBeat: 0,
              notes: [62, 65, 69, 72],
              enabledSteps: [true, false, true, true],
            }),
          ],
          meterSource: null,
          volumeDb: 0,
          isMuted: false,
          isRecEnabled: true,
        },
      ],
    })

    flushSync(() => {
      root.render(<TrackZone model={model} actions={makeActions()} />)
    })

    const notes = container.querySelectorAll('.midi-clip-note')
    expect(notes).toHaveLength(3)
  })

  it('wraps playhead inside clip start+length window when looping', async () => {
    const clipModel = makeClipModel({
      startBeat: 0.5,
      notes: [60, 62, 64, 65, 67, 69, 71],
    })
    const bpm = 120
    const pps = getPixelsPerSecond(bpm)
    const clipStartPx = clipModel.clip.startBeat * beatDurationSeconds(bpm) * pps
    const clipWidthPx = clipModel.clip.lengthSteps * STEP_BEATS * beatDurationSeconds(bpm) * pps
    const absolutePlayheadPx = 2.4 * pps
    const expectedWrappedPx = clipStartPx + ((absolutePlayheadPx - clipStartPx) % clipWidthPx)
    const model = makeModel({
      playbackState: 'paused',
      bpm,
      loop: true,
      getPositionSeconds: () => 2.4,
      tracks: [
        {
          trackId: 'track-1',
          displayName: 'Track 1',
          clips: [clipModel],
          meterSource: null,
          volumeDb: 0,
          isMuted: false,
          isRecEnabled: true,
        },
      ],
    })

    flushSync(() => {
      root.render(<TrackZone model={model} actions={makeActions()} />)
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    const playhead = container.querySelector('.playhead') as HTMLElement
    expect(playhead).toBeTruthy()
    expect(parseFloat(playhead.style.left)).toBeCloseTo(expectedWrappedPx, 5)
  })

  it('renders track rows from model.tracks and master row from model.masterTrack', () => {
    const actions = makeActions()
    const model = makeModel({
      selectedTrackId: 'track-2',
      tracks: [
        {
          trackId: 'track-1',
          displayName: 'Track One',
          clips: [makeClipModel({ clipId: 'clip-1', startBeat: 0, notes: [60, 62] })],
          meterSource: null,
          volumeDb: 0,
          isMuted: false,
          isRecEnabled: true,
        },
        {
          trackId: 'track-2',
          displayName: 'Track Two',
          clips: [makeClipModel({ clipId: 'clip-2', startBeat: 1, notes: [67, 69] })],
          meterSource: null,
          volumeDb: 0,
          isMuted: false,
          isRecEnabled: false,
        },
      ],
      masterTrack: {
        trackId: 'master-custom',
        displayName: 'Main Bus',
        meterSource: null,
        volumeDb: 0,
      },
    })

    flushSync(() => {
      root.render(<TrackZone model={model} actions={actions} />)
    })

    const trackRows = Array.from(container.querySelectorAll('.track-row'))
    expect(trackRows).toHaveLength(2)
    expect(trackRows[0]?.getAttribute('data-track-id')).toBe('track-1')
    expect(trackRows[1]?.getAttribute('data-track-id')).toBe('track-2')
    expect(trackRows[1]?.getAttribute('data-selected')).toBe('true')

    ;(trackRows[0] as HTMLElement).click()
    expect(actions.selectTrack).toHaveBeenCalledWith('track-1')

    const masterRow = container.querySelector('.master-track') as HTMLElement
    const masterName = container.querySelector('.master-track-name')
    expect(masterRow.getAttribute('data-track-id')).toBe('master-custom')
    expect(masterName?.textContent).toBe('Main Bus')
  })
})
