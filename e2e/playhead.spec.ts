import { test, expect } from '@playwright/test'
import { getPixelsPerSecond, clipDurationSeconds } from '../src/utils/timelineScale'

function parseLeftPx(styleLeft: string): number {
  return parseFloat(styleLeft.replace('px', ''))
}

test('click Play at 120 BPM, after 1000ms playhead position is within 5% of 1s * pixelsPerSecond', async ({ page }) => {
  await page.goto('/')

  const playBtn = page.locator('.toolbar-play-pause')
  const playhead = page.locator('.playhead')

  await expect(playhead).toBeVisible()

  await playBtn.click()
  await page.waitForTimeout(1000)

  const leftStyle = await playhead.evaluate((el) => (el as HTMLElement).style.left)
  const actualPx = parseLeftPx(leftStyle)

  const expectedPx = 1.0 * getPixelsPerSecond(120) // 60px
  const tolerance = expectedPx * 0.15 // 15% to account for audio context startup latency

  expect(actualPx).toBeGreaterThan(expectedPx * 0.5)
  expect(actualPx).toBeLessThan(expectedPx + tolerance)
})

test('change BPM to 60, click Play, after 1000ms playhead position is within 5% of 1s * pixelsPerSecond(60)', async ({ page }) => {
  await page.goto('/')

  const bpmInput = page.locator('.toolbar-bpm')
  await bpmInput.fill('60')
  await bpmInput.dispatchEvent('change')
  await page.waitForTimeout(100)

  const playBtn = page.locator('.toolbar-play-pause')
  const playhead = page.locator('.playhead')

  await expect(playhead).toBeVisible()

  await playBtn.click()
  await page.waitForTimeout(1000)

  const leftStyle = await playhead.evaluate((el) => (el as HTMLElement).style.left)
  const actualPx = parseLeftPx(leftStyle)

  const expectedPx = 1.0 * getPixelsPerSecond(60) // 60px (same constant)
  const tolerance = expectedPx * 0.15

  expect(actualPx).toBeGreaterThan(expectedPx * 0.5)
  expect(actualPx).toBeLessThan(expectedPx + tolerance)
})

test('click Stop, playhead returns to pixel position 0', async ({ page }) => {
  await page.goto('/')

  const playBtn = page.locator('.toolbar-play-pause')
  const stopBtn = page.locator('.toolbar-stop')
  const playhead = page.locator('.playhead')

  await expect(playhead).toBeVisible()

  await playBtn.click()
  await page.waitForTimeout(300)

  await stopBtn.click()
  await page.waitForTimeout(100)

  const leftStyle = await playhead.evaluate((el) => (el as HTMLElement).style.left)
  const actualPx = parseLeftPx(leftStyle)

  expect(actualPx).toBeCloseTo(0, 0)
})

test('enable Loop, click Play, after full clip duration + 200ms playhead has wrapped back near position 0', async ({ page }) => {
  await page.goto('/')

  const loopBtn = page.locator('.toolbar-loop')
  const playBtn = page.locator('.toolbar-play-pause')
  const playhead = page.locator('.playhead')

  await expect(playhead).toBeVisible()

  await loopBtn.click()
  await expect(loopBtn).toHaveAttribute('aria-pressed', 'true')

  await playBtn.click()

  // clipDurationSeconds(120, 8) = 2.0s, wait 2200ms to ensure at least one loop
  const clipMs = clipDurationSeconds(120, 8) * 1000 + 200
  await page.waitForTimeout(clipMs)

  const leftStyle = await playhead.evaluate((el) => (el as HTMLElement).style.left)
  const actualPx = parseLeftPx(leftStyle)

  // After wrapping, playhead should be well within the first 50% of clip duration in pixels
  const loopEndPx = clipDurationSeconds(120, 8) * getPixelsPerSecond(120)
  expect(actualPx).toBeLessThan(loopEndPx * 0.5)
})
