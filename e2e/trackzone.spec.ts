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

test('track zone height fills viewport minus toolbar and device panel heights', async ({ page }) => {
  await page.goto('/')
  const trackZone = page.locator('.track-zone')
  const devicePanel = page.locator('.device-panel')

  const viewportHeight = page.viewportSize()!.height
  const trackZoneBox = await trackZone.boundingBox()
  const devicePanelBox = await devicePanel.boundingBox()

  expect(trackZoneBox).not.toBeNull()
  expect(devicePanelBox).not.toBeNull()

  // Track zone top should be at toolbar height (48px)
  expect(Math.round(trackZoneBox!.y)).toBe(48)

  // Track zone bottom should align with device panel top
  expect(Math.round(trackZoneBox!.y + trackZoneBox!.height)).toBe(Math.round(devicePanelBox!.y))

  // Track zone should fill the gap: viewport - toolbar - device panel - midi keyboard
  const midiKeyboard = page.locator('.midi-keyboard')
  const midiKeyboardBox = await midiKeyboard.boundingBox()
  expect(midiKeyboardBox).not.toBeNull()
  const expectedHeight = viewportHeight - 48 - devicePanelBox!.height - midiKeyboardBox!.height
  expect(Math.round(trackZoneBox!.height)).toBe(Math.round(expectedHeight))
})

test('synth1 track row is at the top of the track zone', async ({ page }) => {
  await page.goto('/')
  const trackZone = page.locator('.track-zone')
  const trackRow = page.locator('.track-list .track-row')

  const trackZoneBox = await trackZone.boundingBox()
  const trackRowBox = await trackRow.boundingBox()

  expect(trackZoneBox).not.toBeNull()
  expect(trackRowBox).not.toBeNull()

  // synth1 row should be at the top of track zone
  expect(Math.round(trackRowBox!.y)).toBe(Math.round(trackZoneBox!.y))
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
