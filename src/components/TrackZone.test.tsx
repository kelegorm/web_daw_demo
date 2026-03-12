import * as React from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TrackZone from './TrackZone'
import type { MidiClipStore, MidiStep } from '../project-runtime/midiClipStore'
import { STEP_BEATS } from '../project-runtime/midiClipStore'
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

function makeClipStore({
  clipId = 'clip-test',
  startBeat,
  notes,
  enabledSteps,
}: {
  clipId?: string
  startBeat: number
  notes: number[]
  enabledSteps?: boolean[]
}): { clipStore: MidiClipStore; clipId: string } {
  const steps: MidiStep[] = notes.map((note, index) => ({
    enabled: enabledSteps?.[index] ?? true,
    note,
    velocity: 100,
    gate: 0.8,
  }))

  return {
    clipId,
    clipStore: {
      [clipId]: {
        clipId,
        startBeat,
        lengthSteps: steps.length,
        steps,
      },
    },
  }
}

describe('TrackZone clip-driven layout', () => {
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

  it('derives clip and loop-region geometry from startBeat and lengthSteps', () => {
    const clipInput = makeClipStore({
      startBeat: 0.5,
      notes: [60, 62, 64, 65, 67, 69, 71],
    })
    const bpm = 120
    const pps = getPixelsPerSecond(bpm)
    const expectedLeft = clipInput.clipStore[clipInput.clipId]!.startBeat * beatDurationSeconds(bpm) * pps
    const expectedWidth = clipInput.clipStore[clipInput.clipId]!.lengthSteps * STEP_BEATS * beatDurationSeconds(bpm) * pps

    flushSync(() => {
      root.render(
        <TrackZone
          playbackState="stopped"
          bpm={bpm}
          loop={true}
          clipStore={clipInput.clipStore}
          clipId={clipInput.clipId}
        />,
      )
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

  it('renders MIDI notes from clip step data instead of fixed inline notes', () => {
    const clipInput = makeClipStore({
      startBeat: 0,
      notes: [62, 65, 69, 72],
      enabledSteps: [true, false, true, true],
    })

    flushSync(() => {
      root.render(
        <TrackZone
          playbackState="stopped"
          bpm={120}
          clipStore={clipInput.clipStore}
          clipId={clipInput.clipId}
        />,
      )
    })

    const notes = container.querySelectorAll('.midi-clip-note')
    expect(notes).toHaveLength(3)
  })

  it('wraps playhead inside clip start+length window when looping', async () => {
    const clipInput = makeClipStore({
      startBeat: 0.5,
      notes: [60, 62, 64, 65, 67, 69, 71],
    })
    const bpm = 120
    const pps = getPixelsPerSecond(bpm)
    const clip = clipInput.clipStore[clipInput.clipId]!
    const clipStartPx = clip.startBeat * beatDurationSeconds(bpm) * pps
    const clipWidthPx = clip.lengthSteps * STEP_BEATS * beatDurationSeconds(bpm) * pps
    const absolutePlayheadPx = 2.4 * pps
    const expectedWrappedPx = clipStartPx + ((absolutePlayheadPx - clipStartPx) % clipWidthPx)

    flushSync(() => {
      root.render(
        <TrackZone
          playbackState="paused"
          bpm={bpm}
          loop={true}
          clipStore={clipInput.clipStore}
          clipId={clipInput.clipId}
          getPositionSeconds={() => 2.4}
        />,
      )
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    const playhead = container.querySelector('.playhead') as HTMLElement
    expect(playhead).toBeTruthy()
    expect(parseFloat(playhead.style.left)).toBeCloseTo(expectedWrappedPx, 5)
  })
})
