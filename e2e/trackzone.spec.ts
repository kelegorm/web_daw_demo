import { test, expect, Page } from '@playwright/test'

async function setSliderValue(page: Page, selector: string, value: number) {
  await page.locator(selector).evaluate((el: HTMLInputElement, val: number) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    nativeInputValueSetter.call(el, val)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

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

test('volume fader default position shows 0 dB label', async ({ page }) => {
  await page.goto('/')
  const label = page.locator('.track-volume-label')
  await expect(label).toBeVisible()
  const text = await label.textContent()
  expect(text).toMatch(/^\+?0/)
})

test('drag volume fader to leftmost position shows -∞ label', async ({ page }) => {
  await page.goto('/')
  await setSliderValue(page, '.track-volume', 0)
  const label = page.locator('.track-volume-label')
  const text = await label.textContent()
  expect(text).toContain('-∞')
})

test('drag volume fader to rightmost position shows +6 label', async ({ page }) => {
  await page.goto('/')
  await setSliderValue(page, '.track-volume', 100)
  const label = page.locator('.track-volume-label')
  const text = await label.textContent()
  expect(text).toMatch(/\+?6/)
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
