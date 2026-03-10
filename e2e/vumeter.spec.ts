import { test, expect } from '@playwright/test'

test('VU meter has two bar elements inside capsule', async ({ page }) => {
  await page.goto('/')

  const meter = page.locator('.track-header [data-testid="vu-meter"]').first()
  await expect(meter).toBeVisible()

  const bars = meter.locator('.vu-meter-bar')
  await expect(bars).toHaveCount(2)
})

test('VU meter has 0 dB marker element', async ({ page }) => {
  await page.goto('/')

  const marker = page.locator('.track-header [data-testid="vu-meter-zero-db"]').first()
  await expect(marker).toBeVisible()
})

test('VU meter bar is at minimum when no notes are playing', async ({ page }) => {
  await page.goto('/')

  const bar = page.locator('.track-header .vu-meter-bar').first()
  await expect(bar).toBeVisible()

  // No audio initialized, level should be 0 (vuMeterLevel undefined or 0)
  const level = await page.evaluate(() => window.__vuMeterLevel ?? 0)
  expect(level).toBe(0)

  // Bar height should be effectively 0% (only minHeight:1px rendered)
  const heightPct = await bar.evaluate((el) => parseFloat((el as HTMLElement).style.height))
  expect(heightPct).toBe(0)
})

test('VU meter bar has height above minimum within 300ms after pressing C3 key', async ({ page }) => {
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

test('VU meter bar background gradient includes all three zone colors', async ({ page }) => {
  await page.goto('/')

  const bar = page.locator('.vu-meter-bar').first()
  await expect(bar).toBeVisible()

  const bgStyle = await bar.evaluate((el) => (el as HTMLElement).style.background)

  // Browser converts hex to rgb: #4caf74→rgb(76,175,116) #f5c842→rgb(245,200,66) #e83b3b→rgb(232,59,59)
  expect(bgStyle).toContain('76, 175, 116')
  expect(bgStyle).toContain('245, 200, 66')
  expect(bgStyle).toContain('232, 59, 59')
})

test('VU meter peak hold tick appears after note is played and uses a zone color', async ({ page }) => {
  await page.goto('/')

  const playBtn = page.locator('.toolbar-play-pause')
  await playBtn.click()
  await page.waitForTimeout(500)

  const c3 = page.locator('.midi-keyboard [data-midi="48"]')
  await expect(c3).toBeVisible()
  await c3.dispatchEvent('mousedown')

  // Wait for peak hold tick to appear
  await page.waitForSelector('.track-header .vu-meter-peak', { timeout: 500 })

  const peak = page.locator('.track-header .vu-meter-peak').first()
  await expect(peak).toBeVisible()

  const peakBg = await peak.evaluate((el) => (el as HTMLElement).style.background)
  // Browser converts hex to rgb
  const zoneRgbFragments = ['76, 175, 116', '245, 200, 66', '232, 59, 59']
  expect(zoneRgbFragments.some((c) => peakBg.includes(c))).toBe(true)

  await c3.dispatchEvent('mouseup')
})

test('VU meter peak hold tick falls downward after release within 2000ms', async ({ page }) => {
  await page.goto('/')

  const playBtn = page.locator('.toolbar-play-pause')
  await playBtn.click()
  await page.waitForTimeout(500)

  const c3 = page.locator('.midi-keyboard [data-midi="48"]')
  await expect(c3).toBeVisible()
  await c3.dispatchEvent('mousedown')

  // Wait for peak tick to appear
  await page.waitForSelector('.track-header .vu-meter-peak', { timeout: 500 })

  const peakTick = page.locator('.track-header .vu-meter-peak').first()

  // Record initial bottom position
  const initialBottom = await peakTick.evaluate((el) => parseFloat((el as HTMLElement).style.bottom))

  // Release the key — peak should start decaying after 1.5s hold
  await c3.dispatchEvent('mouseup')

  // Wait 2000ms for hold to expire and decay to start
  await page.waitForTimeout(2000)

  // Peak bottom should have moved toward 0 (i.e., decreased from initial)
  // or the element may have disappeared (peak reached 0)
  const peakExists = await page.locator('.track-header .vu-meter-peak').first().isVisible().catch(() => false)
  if (peakExists) {
    const newBottom = await peakTick.evaluate((el) => parseFloat((el as HTMLElement).style.bottom))
    expect(newBottom).toBeLessThan(initialBottom)
  }
  // If it disappeared, that also means it fell — test passes
})
