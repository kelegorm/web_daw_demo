import { test, expect } from '@playwright/test'

test('transport buttons are positioned to the right of title and left of viewport center', async ({ page }) => {
  await page.goto('/')

  const title = page.locator('.toolbar-app-name')
  const playBtn = page.locator('.toolbar-play-pause')

  const titleBox = await title.boundingBox()
  const playBox = await playBtn.boundingBox()
  const viewportSize = page.viewportSize()

  expect(titleBox).not.toBeNull()
  expect(playBox).not.toBeNull()
  expect(viewportSize).not.toBeNull()

  // Play button starts to the right of the title's right edge
  expect(playBox!.x).toBeGreaterThan(titleBox!.x + titleBox!.width)
  // Play button center is left of viewport center
  const playCenter = playBox!.x + playBox!.width / 2
  expect(playCenter).toBeLessThan(viewportSize!.width / 2)
})

test('gap between title and first transport button is at least 32px', async ({ page }) => {
  await page.goto('/')

  const title = page.locator('.toolbar-app-name')
  const transport = page.locator('.toolbar-transport')

  const titleBox = await title.boundingBox()
  const transportBox = await transport.boundingBox()

  expect(titleBox).not.toBeNull()
  expect(transportBox).not.toBeNull()

  const gap = transportBox!.x - (titleBox!.x + titleBox!.width)
  expect(gap).toBeGreaterThanOrEqual(32)
})

test('click Play on toolbar changes button label to Pause', async ({ page }) => {
  await page.goto('/')

  const btn = page.locator('.toolbar-play-pause')
  await expect(btn).toBeVisible()
  await expect(btn).toHaveText('Play')

  await btn.click()
  await expect(btn).toHaveText('Pause')
})

test('change toolbar BPM input to 140, verify displayed value is 140', async ({ page }) => {
  await page.goto('/')

  const bpmInput = page.locator('.toolbar-bpm')
  await expect(bpmInput).toBeVisible()

  await bpmInput.fill('140')
  await bpmInput.blur()

  await expect(bpmInput).toHaveValue('140')
})

test('click toolbar Panic releases all active notes', async ({ page }) => {
  await page.goto('/')

  // Reset panic count tracking
  await page.evaluate(() => { window.__panicCount = 0 })

  const panicBtn = page.locator('.toolbar-panic')
  await panicBtn.click()

  const panicCount = await page.evaluate(() => window.__panicCount)
  expect(panicCount).toBeGreaterThan(0)
})
