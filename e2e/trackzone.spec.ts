import { test, expect } from '@playwright/test'

test('track header contains text synth1', async ({ page }) => {
  await page.goto('/')
  const trackName = page.locator('.track-name')
  await expect(trackName).toBeVisible()
  await expect(trackName).toHaveText('synth1')
})

test('Mute button has aria-pressed="false" by default', async ({ page }) => {
  await page.goto('/')
  const muteBtn = page.locator('.track-mute')
  await expect(muteBtn).toBeVisible()
  await expect(muteBtn).toHaveAttribute('aria-pressed', 'false')
})

test('Rec button has aria-pressed="true" by default', async ({ page }) => {
  await page.goto('/')
  const recBtn = page.locator('.track-rec')
  await expect(recBtn).toBeVisible()
  await expect(recBtn).toHaveAttribute('aria-pressed', 'true')
})

test('click Play then playhead moves within 500ms', async ({ page }) => {
  await page.goto('/')

  const playhead = page.locator('.playhead')
  await expect(playhead).toBeVisible()

  const initialLeft = await playhead.evaluate((el) => (el as HTMLElement).style.left)

  const playBtn = page.locator('.toolbar-play-pause')
  await playBtn.click()

  await page.waitForTimeout(500)

  const movedLeft = await playhead.evaluate((el) => (el as HTMLElement).style.left)

  expect(movedLeft).not.toEqual(initialLeft)
})
