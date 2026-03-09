import { test, expect } from '@playwright/test'

test('full integration smoke: play, piano key, meter reacts, sequencer advances, no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')

  // App mounts with all key components visible
  await expect(page.locator('#root')).toBeVisible()
  await expect(page.locator('.transport-play-pause')).toBeVisible()
  await expect(page.locator('.vu-meter').first()).toBeVisible()
  await expect(page.locator('.parameter-panel')).toBeVisible()
  await expect(page.locator('.sequencer-display')).toBeVisible()
  await expect(page.locator('.piano-keyboard')).toBeVisible()

  // Click Play — initializes audio and starts sequencer
  const playBtn = page.locator('.transport-play-pause')
  await playBtn.click()
  await expect(playBtn).toHaveText('Pause')

  // Wait for audio context and worklet to initialize
  await page.waitForTimeout(600)

  // Verify at least 2 different sequencer steps became active over ~2 beats
  await page.waitForFunction(
    () => {
      const steps = window.__activeSteps ?? []
      const unique = new Set(steps)
      return unique.size >= 2
    },
    { timeout: 3000 }
  )

  // Click a piano key and verify meter reacts (use midi-keyboard which routes through panner analyser)
  const c4 = page.locator('.midi-keyboard [data-midi="60"]')
  await expect(c4).toBeVisible()
  await c4.dispatchEvent('mousedown')

  await page.waitForFunction(
    () => (window.__vuMeterLevel ?? 0) > 0,
    { timeout: 500 }
  )

  const level = await page.evaluate(() => window.__vuMeterLevel ?? 0)
  expect(level).toBeGreaterThan(0)

  await c4.dispatchEvent('mouseup')

  // No console errors
  expect(errors).toHaveLength(0)
})
