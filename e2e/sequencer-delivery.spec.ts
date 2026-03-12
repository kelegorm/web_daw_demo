import { expect, test, type Page } from '@playwright/test'
import { expectPlayState } from './helpers/toolbar'
import { beatDurationSeconds, getPixelsPerSecond } from '../src/utils/timelineScale'
import {
  DEFAULT_MIDI_CLIP_ID,
  DEFAULT_MIDI_CLIP_STORE,
  getMidiClipLengthBeats,
  getMidiClipOrThrow,
} from '../src/project-runtime/midiClipStore'

type E2EHooksState = {
  sequencerTicks: number
  sequencerNoteOnSent: number
  sequencerNoteOffSent: number
  synthNoteOnReceived: number
  synthNoteOffReceived: number
  synthPanicReceived: number
}

const DEFAULT_CLIP = getMidiClipOrThrow(DEFAULT_MIDI_CLIP_STORE, DEFAULT_MIDI_CLIP_ID)
const DEFAULT_CLIP_STEPS = DEFAULT_CLIP.steps.slice(0, DEFAULT_CLIP.lengthSteps)
const DEFAULT_ENABLED_STEPS = DEFAULT_CLIP_STEPS.filter((step) => step.enabled)
const DEFAULT_NOTE_COUNT = DEFAULT_ENABLED_STEPS.length

function getExpectedClipLeftPx(bpm: number): number {
  return DEFAULT_CLIP.startBeat * beatDurationSeconds(bpm) * getPixelsPerSecond(bpm)
}

function getExpectedClipWidthPx(bpm: number): number {
  return getMidiClipLengthBeats(DEFAULT_CLIP) * beatDurationSeconds(bpm) * getPixelsPerSecond(bpm)
}

function getClipDurationMs(bpm: number): number {
  return getMidiClipLengthBeats(DEFAULT_CLIP) * beatDurationSeconds(bpm) * 1000
}

async function enableE2EHooks(page: Page) {
  await page.addInitScript(() => {
    const appWindow = window as Window & {
      __e2eHooksEnabled?: boolean
      __e2eHooks?: E2EHooksState
    }
    appWindow.__e2eHooksEnabled = true
    appWindow.__e2eHooks = {
      sequencerTicks: 0,
      sequencerNoteOnSent: 0,
      sequencerNoteOffSent: 0,
      synthNoteOnReceived: 0,
      synthNoteOffReceived: 0,
      synthPanicReceived: 0,
    }
  })
}

test('one clip playback: sequencer and synth counts follow enabled clip steps', async ({ page }) => {
  await enableE2EHooks(page)

  await page.goto('/')

  const playBtn = page.locator('.toolbar-play-pause')
  const loopBtn = page.locator('.toolbar-loop')

  await expect(playBtn).toBeVisible()
  if ((await loopBtn.getAttribute('aria-pressed')) !== 'false') {
    await loopBtn.click()
  }
  await expect(loopBtn).toHaveAttribute('aria-pressed', 'false')

  await page.evaluate(() => {
    const appWindow = window as Window & {
      __e2eHooks?: E2EHooksState
      __activeSteps?: number[]
    }
    appWindow.__activeSteps = []
    if (appWindow.__e2eHooks) {
      appWindow.__e2eHooks.sequencerTicks = 0
      appWindow.__e2eHooks.sequencerNoteOnSent = 0
      appWindow.__e2eHooks.sequencerNoteOffSent = 0
      appWindow.__e2eHooks.synthNoteOnReceived = 0
      appWindow.__e2eHooks.synthNoteOffReceived = 0
      appWindow.__e2eHooks.synthPanicReceived = 0
    }
  })

  await playBtn.click()
  await expectPlayState(playBtn, 'pause')

  await page.waitForFunction(() => {
    const hooks = (window as Window & { __e2eHooks?: E2EHooksState }).__e2eHooks
    return !!hooks && hooks.sequencerNoteOnSent >= 1 && hooks.synthNoteOnReceived >= 1
  }, { timeout: 7000 })

  await page.waitForFunction(
    (expectedCount) => {
      const hooks = (window as Window & { __e2eHooks?: E2EHooksState }).__e2eHooks
      return (
        !!hooks &&
        hooks.sequencerNoteOnSent >= expectedCount &&
        hooks.sequencerNoteOffSent >= expectedCount &&
        hooks.synthNoteOnReceived >= expectedCount &&
        hooks.synthNoteOffReceived >= expectedCount
      )
    },
    DEFAULT_NOTE_COUNT,
    { timeout: 7000 },
  )

  await page.waitForTimeout(500)
  const firstSnapshot = await page.evaluate(() => {
    return (window as Window & { __e2eHooks?: E2EHooksState }).__e2eHooks!
  })

  await page.waitForTimeout(700)
  const secondSnapshot = await page.evaluate(() => {
    return (window as Window & { __e2eHooks?: E2EHooksState }).__e2eHooks!
  })

  expect(firstSnapshot.sequencerNoteOnSent).toBe(DEFAULT_NOTE_COUNT)
  expect(firstSnapshot.sequencerNoteOffSent).toBe(DEFAULT_NOTE_COUNT)
  expect(firstSnapshot.synthNoteOnReceived).toBe(DEFAULT_NOTE_COUNT)
  expect(firstSnapshot.synthNoteOffReceived).toBe(DEFAULT_NOTE_COUNT)

  expect(secondSnapshot.sequencerNoteOnSent).toBe(firstSnapshot.sequencerNoteOnSent)
  expect(secondSnapshot.sequencerNoteOffSent).toBe(firstSnapshot.sequencerNoteOffSent)
  expect(secondSnapshot.synthNoteOnReceived).toBe(firstSnapshot.synthNoteOnReceived)
  expect(secondSnapshot.synthNoteOffReceived).toBe(firstSnapshot.synthNoteOffReceived)
})

test('one-source clip chain: clip store drives sequencer delivery, loop geometry, and playhead wrap', async ({ page }) => {
  await enableE2EHooks(page)
  await page.goto('/')

  const playBtn = page.locator('.toolbar-play-pause')
  const stopBtn = page.locator('.toolbar-stop')
  const loopBtn = page.locator('.toolbar-loop')
  const clip = page.locator('.midi-clip')
  const rulerLoopRegion = page.locator('.timeline-loop-region')
  const trackLoopRegion = page.locator('.timeline-loop-region-track')
  const trackTimeline = page.locator('.track-timeline')
  const playhead = page.locator('.playhead')

  await expect(clip).toBeVisible()
  await expect(playhead).toBeVisible()
  await expect(loopBtn).toHaveAttribute('aria-pressed', 'true')

  const clipBox = await clip.boundingBox()
  const rulerRegionBox = await rulerLoopRegion.boundingBox()
  const trackRegionBox = await trackLoopRegion.boundingBox()
  const trackTimelineBox = await trackTimeline.boundingBox()

  expect(clipBox).not.toBeNull()
  expect(rulerRegionBox).not.toBeNull()
  expect(trackRegionBox).not.toBeNull()
  expect(trackTimelineBox).not.toBeNull()

  const expectedLeft = getExpectedClipLeftPx(120)
  const expectedWidth = getExpectedClipWidthPx(120)
  const clipRelativeLeft = clipBox!.x - trackTimelineBox!.x
  const trackLoopRelativeLeft = trackRegionBox!.x - trackTimelineBox!.x

  expect(Math.abs(clipRelativeLeft - expectedLeft)).toBeLessThanOrEqual(2)
  expect(Math.abs(trackLoopRelativeLeft - expectedLeft)).toBeLessThanOrEqual(2)
  expect(Math.abs(clipBox!.width - expectedWidth)).toBeLessThanOrEqual(2)
  expect(Math.abs(trackRegionBox!.width - expectedWidth)).toBeLessThanOrEqual(2)
  expect(Math.abs(rulerRegionBox!.width - expectedWidth)).toBeLessThanOrEqual(2)

  if ((await loopBtn.getAttribute('aria-pressed')) !== 'false') {
    await loopBtn.click()
  }
  await expect(loopBtn).toHaveAttribute('aria-pressed', 'false')

  await page.evaluate(() => {
    const appWindow = window as Window & {
      __activeSteps?: number[]
      __e2eHooks?: E2EHooksState
    }
    appWindow.__activeSteps = []
    if (appWindow.__e2eHooks) {
      appWindow.__e2eHooks.sequencerTicks = 0
      appWindow.__e2eHooks.sequencerNoteOnSent = 0
      appWindow.__e2eHooks.sequencerNoteOffSent = 0
      appWindow.__e2eHooks.synthNoteOnReceived = 0
      appWindow.__e2eHooks.synthNoteOffReceived = 0
      appWindow.__e2eHooks.synthPanicReceived = 0
    }
  })

  await playBtn.click()
  await expectPlayState(playBtn, 'pause')

  await page.waitForFunction(
    (expectedStepCount) => (window.__activeSteps ?? []).length >= expectedStepCount,
    DEFAULT_CLIP.lengthSteps,
    { timeout: 7000 },
  )

  await page.waitForFunction(
    (expectedNoteCount) => {
      const hooks = (window as Window & { __e2eHooks?: E2EHooksState }).__e2eHooks
      return !!hooks && hooks.sequencerNoteOnSent >= expectedNoteCount && hooks.synthNoteOnReceived >= expectedNoteCount
    },
    DEFAULT_NOTE_COUNT,
    { timeout: 7000 },
  )

  await page.waitForTimeout(500)
  const oneShot = await page.evaluate(() => {
    const appWindow = window as Window & {
      __activeSteps?: number[]
      __e2eHooks?: E2EHooksState
    }
    return {
      activeSteps: appWindow.__activeSteps ?? [],
      hooks: appWindow.__e2eHooks!,
    }
  })

  expect(oneShot.activeSteps).toHaveLength(DEFAULT_CLIP.lengthSteps)
  expect(oneShot.hooks.sequencerNoteOnSent).toBe(DEFAULT_NOTE_COUNT)
  expect(oneShot.hooks.synthNoteOnReceived).toBe(DEFAULT_NOTE_COUNT)

  await stopBtn.click()
  await expectPlayState(playBtn, 'play')

  if ((await loopBtn.getAttribute('aria-pressed')) !== 'true') {
    await loopBtn.click()
  }
  await expect(loopBtn).toHaveAttribute('aria-pressed', 'true')

  await page.evaluate(() => {
    ;(window as Window & { __activeSteps?: number[] }).__activeSteps = []
  })

  await playBtn.click()
  await expectPlayState(playBtn, 'pause')

  await page.waitForFunction(
    (expectedStepCount) => (window.__activeSteps ?? []).length > expectedStepCount,
    DEFAULT_CLIP.lengthSteps,
    { timeout: 7000 },
  )
  await page.waitForTimeout(getClipDurationMs(120) + 200)

  const loopedSteps = await page.evaluate(() => (window.__activeSteps ?? []).slice())
  const hasWrappedStep = loopedSteps.slice(DEFAULT_CLIP.lengthSteps).includes(0)
  expect(hasWrappedStep).toBe(true)

  const playheadLeft = await playhead.evaluate((el) => (el as HTMLElement).style.left)
  const playheadPx = parseFloat(playheadLeft.replace('px', ''))
  expect(playheadPx).toBeGreaterThanOrEqual(expectedLeft)
  expect(playheadPx).toBeLessThan(expectedLeft + expectedWidth)
})
