import { test, expect } from '@playwright/test'

test('VU meter bar is at minimum when no notes are playing', async ({ page }) => {
  await page.goto('/')

  const bar = page.locator('.track-header .vu-meter-bar')
  await expect(bar).toBeVisible()

  // No audio initialized, level should be 0 (vuMeterLevel undefined or 0)
  const level = await page.evaluate(() => window.__vuMeterLevel ?? 0)
  expect(level).toBe(0)

  // Bar height should be effectively 0% (only minHeight:1px rendered)
  const heightPct = await bar.evaluate((el) => parseFloat((el as HTMLElement).style.height))
  expect(heightPct).toBe(0)
})

test('VU meter in track header exceeds minimum within 300ms after pressing C3 key', async ({ page }) => {
  await page.goto('/')

  // Click Play to initialize Tone.js audio context
  const playBtn = page.locator('.toolbar-play-pause')
  await playBtn.click()
  await page.waitForTimeout(500)

  // Press C3 on MIDI keyboard (MIDI 48)
  const c3 = page.locator('.midi-keyboard [data-midi="48"]')
  await expect(c3).toBeVisible()
  await c3.dispatchEvent('mousedown')

  // Wait up to 300ms for VU meter level to increase above 0
  await page.waitForFunction(
    () => (window.__vuMeterLevel ?? 0) > 0,
    { timeout: 300 }
  )

  const level = await page.evaluate(() => window.__vuMeterLevel ?? 0)
  expect(level).toBeGreaterThan(0)

  await c3.dispatchEvent('mouseup')
})

test('VU meter returns to minimum within 300ms after clicking Mute', async ({ page }) => {
  await page.goto('/')

  // Initialize audio and play a note
  const playBtn = page.locator('.toolbar-play-pause')
  await playBtn.click()
  await page.waitForTimeout(500)

  const c3 = page.locator('.midi-keyboard [data-midi="48"]')
  await c3.dispatchEvent('mousedown')

  // Wait for meter to show activity
  await page.waitForFunction(
    () => (window.__vuMeterLevel ?? 0) > 0,
    { timeout: 300 }
  )

  // Click mute button via JS dispatch to bypass layout overlap
  const muteBtn = page.locator('.track-mute')
  await muteBtn.dispatchEvent('click')

  // Meter should freeze at 0 within 300ms
  await page.waitForTimeout(300)
  const level = await page.evaluate(() => window.__vuMeterLevel ?? 0)
  expect(level).toBe(0)

  await c3.dispatchEvent('mouseup')
})

test('VU meter level increases within 200ms after piano key press with audio initialized', async ({ page }) => {
  await page.goto('/')

  // Click Play to initialize audio context
  const playBtn = page.locator('.toolbar-play-pause')
  await playBtn.click()
  // Give audio context time to initialize
  await page.waitForTimeout(500)

  // Press C3 on MIDI keyboard (MIDI 48)
  const c3 = page.locator('.midi-keyboard [data-midi="48"]')
  await expect(c3).toBeVisible()
  await c3.dispatchEvent('mousedown')

  // Wait up to 200ms for VU meter level to increase above 0
  await page.waitForFunction(
    () => (window.__vuMeterLevel ?? 0) > 0,
    { timeout: 200 }
  )

  const level = await page.evaluate(() => window.__vuMeterLevel ?? 0)
  expect(level).toBeGreaterThan(0)

  await c3.dispatchEvent('mouseup')
})
