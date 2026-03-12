import { test, expect } from '@playwright/test'
import { expectPlayState } from './helpers/toolbar'
import {
  DEFAULT_MIDI_CLIP_ID,
  DEFAULT_MIDI_CLIP_STORE,
  getMidiClipOrThrow,
} from '../src/project-runtime/midiClipStore'

const DEFAULT_CLIP = getMidiClipOrThrow(DEFAULT_MIDI_CLIP_STORE, DEFAULT_MIDI_CLIP_ID)
const DEFAULT_CLIP_LENGTH_STEPS = DEFAULT_CLIP.lengthSteps

test('click Play, wait 1000ms at 120 BPM, verify at least 2 different step indicators highlighted', async ({ page }) => {
  await page.goto('/')

  // Click Play via toolbar
  const playBtn = page.locator('.toolbar-play-pause')
  await playBtn.click()
  await expectPlayState(playBtn, 'pause')

  // Wait for at least 2 different step indicators to have been highlighted.
  // BPM=120, 8th note=250ms. Wait ~1000ms for 4 beats.
  await page.waitForFunction(
    () => {
      const steps = window.__activeSteps ?? []
      const unique = new Set(steps)
      return unique.size >= 2
    },
    { timeout: 5000 },
  )

  const activeSteps = await page.evaluate(() => window.__activeSteps ?? [])
  const uniqueSteps = new Set(activeSteps)
  expect(uniqueSteps.size).toBeGreaterThanOrEqual(2)

  // Click Pause
  await playBtn.click()
  await expectPlayState(playBtn, 'play')
})

test('single Stop allows next Play to resume sequencing', async ({ page }) => {
  await page.goto('/')

  const playBtn = page.locator('.toolbar-play-pause')
  const stopBtn = page.locator('.toolbar-stop')

  await playBtn.click()
  await expectPlayState(playBtn, 'pause')

  await page.waitForFunction(() => (window.__activeSteps ?? []).length >= 1, { timeout: 5000 })

  await stopBtn.click()
  await expectPlayState(playBtn, 'play')

  const stepsAfterStop = await page.evaluate(() => (window.__activeSteps ?? []).length)

  await playBtn.click()
  await expectPlayState(playBtn, 'pause')

  await page.waitForFunction(
    (prevLen) => (window.__activeSteps ?? []).length > prevLen,
    stepsAfterStop,
    { timeout: 5000 },
  )
})

test('with Loop off, sequence plays one clip length without repeating notes', async ({ page }) => {
  await page.goto('/')

  const playBtn = page.locator('.toolbar-play-pause')
  const loopBtn = page.locator('.toolbar-loop')

  if ((await loopBtn.getAttribute('aria-pressed')) !== 'false') {
    await loopBtn.click()
  }
  await expect(loopBtn).toHaveAttribute('aria-pressed', 'false')

  await playBtn.click()
  await expectPlayState(playBtn, 'pause')

  await page.waitForFunction(
    (expectedSteps) => (window.__activeSteps ?? []).length >= expectedSteps,
    DEFAULT_CLIP_LENGTH_STEPS,
    { timeout: 7000 },
  )
  await page.waitForTimeout(600)

  const stepCount = await page.evaluate(() => (window.__activeSteps ?? []).length)
  expect(stepCount).toBe(DEFAULT_CLIP_LENGTH_STEPS)
})

test('with Loop on, sequence repeats beyond one clip length', async ({ page }) => {
  await page.goto('/')

  const playBtn = page.locator('.toolbar-play-pause')
  const loopBtn = page.locator('.toolbar-loop')

  if ((await loopBtn.getAttribute('aria-pressed')) !== 'true') {
    await loopBtn.click()
  }
  await expect(loopBtn).toHaveAttribute('aria-pressed', 'true')

  await playBtn.click()
  await expectPlayState(playBtn, 'pause')

  await page.waitForFunction(
    (expectedSteps) => (window.__activeSteps ?? []).length > expectedSteps,
    DEFAULT_CLIP_LENGTH_STEPS,
    { timeout: 7000 },
  )
})
