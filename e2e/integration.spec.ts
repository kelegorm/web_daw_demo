import { test, expect } from '@playwright/test'

test('smoke: open app, click Play, press C3, meter reacts, sequencer advances, no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')

  // All DAW layout components are visible
  await expect(page.locator('.toolbar')).toBeVisible()
  await expect(page.locator('.track-zone')).toBeVisible()
  await expect(page.locator('.device-panel')).toBeVisible()
  await expect(page.locator('.midi-keyboard')).toBeVisible()

  // Click Play — starts sequencer
  const playBtn = page.locator('.toolbar-play-pause')
  await expect(playBtn).toBeVisible()
  await playBtn.click()
  await expect(playBtn).toHaveText('Pause')

  // Wait for at least 2 different sequencer steps to become active
  await page.waitForFunction(
    () => {
      const steps = window.__activeSteps ?? []
      const unique = new Set(steps)
      return unique.size >= 2
    },
    { timeout: 4000 }
  )

  // Press C3 (MIDI 48) on the MIDI keyboard and verify meter reacts
  const c3 = page.locator('.midi-keyboard [data-midi="48"]')
  await expect(c3).toBeVisible()
  await c3.dispatchEvent('mousedown')

  await page.waitForFunction(
    () => (window.__vuMeterLevel ?? 0) > 0,
    { timeout: 500 }
  )

  const level = await page.evaluate(() => window.__vuMeterLevel ?? 0)
  expect(level).toBeGreaterThan(0)

  await c3.dispatchEvent('mouseup')

  // No console errors
  expect(errors).toHaveLength(0)
})

test('viewport 1280px wide: no horizontal scrollbar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  // scrollWidth should not exceed clientWidth
  const hasHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })

  expect(hasHorizontalScroll).toBe(false)
})
