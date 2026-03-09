import { test, expect } from '@playwright/test'

test('VU meter bar is at minimum when no notes are playing', async ({ page }) => {
  await page.goto('/')

  const bar = page.locator('.vu-meter-bar')
  await expect(bar).toBeVisible()

  // No audio initialized, level should be 0 (vuMeterLevel undefined or 0)
  const level = await page.evaluate(() => window.__vuMeterLevel ?? 0)
  expect(level).toBe(0)

  // Bar height should be effectively 0% (only minHeight:1px rendered)
  const heightPct = await bar.evaluate((el) => parseFloat((el as HTMLElement).style.height))
  expect(heightPct).toBe(0)
})

test('VU meter level increases within 200ms after piano key press with audio initialized', async ({ page }) => {
  await page.goto('/')

  // Click Play to initialize audio context and worklet
  const playBtn = page.locator('.transport-play-pause')
  await playBtn.click()
  // Give audio context and worklet time to initialize
  await page.waitForTimeout(500)

  // Press a piano key to send a noteOn
  const c4 = page.locator('[data-midi="60"]')
  await expect(c4).toBeVisible()
  await c4.dispatchEvent('mousedown')

  // Wait up to 200ms for VU meter level to increase above 0
  await page.waitForFunction(
    () => (window.__vuMeterLevel ?? 0) > 0,
    { timeout: 200 }
  )

  const level = await page.evaluate(() => window.__vuMeterLevel ?? 0)
  expect(level).toBeGreaterThan(0)

  await c4.dispatchEvent('mouseup')
})
