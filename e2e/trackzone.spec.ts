import { test, expect, Page } from '@playwright/test'
import { clipDurationSeconds, getPixelsPerSecond } from '../src/utils/timelineScale'

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

test('synth1 track row is directly below the timeline ruler', async ({ page }) => {
  await page.goto('/')
  const ruler = page.locator('.timeline-ruler')
  const trackRow = page.locator('.track-list .track-row')

  const rulerBox = await ruler.boundingBox()
  const trackRowBox = await trackRow.boundingBox()

  expect(rulerBox).not.toBeNull()
  expect(trackRowBox).not.toBeNull()

  // synth1 row top should be at or just below the ruler bottom
  expect(Math.round(trackRowBox!.y)).toBe(Math.round(rulerBox!.y + rulerBox!.height))
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

test('Master track label is visible at bottom of track zone', async ({ page }) => {
  await page.goto('/')
  const masterLabel = page.locator('.master-track-name')
  await expect(masterLabel).toBeVisible()
  await expect(masterLabel).toHaveText('Master')

  const trackZone = page.locator('.track-zone')
  const masterTrack = page.locator('.master-track')

  const trackZoneBox = await trackZone.boundingBox()
  const masterTrackBox = await masterTrack.boundingBox()

  expect(trackZoneBox).not.toBeNull()
  expect(masterTrackBox).not.toBeNull()

  // Master track bottom should align with track zone bottom
  const trackZoneBottom = Math.round(trackZoneBox!.y + trackZoneBox!.height)
  const masterTrackBottom = Math.round(masterTrackBox!.y + masterTrackBox!.height)
  expect(masterTrackBottom).toBe(trackZoneBottom)
})

test('clip block width matches clipDurationSeconds * pixelsPerSecond at 120 BPM', async ({ page }) => {
  await page.goto('/')

  const clip = page.locator('.midi-clip')
  await expect(clip).toBeVisible()

  const clipBox = await clip.boundingBox()
  expect(clipBox).not.toBeNull()

  const expectedWidth = clipDurationSeconds(120, 8) * getPixelsPerSecond(120)
  expect(clipBox!.width).toBeCloseTo(expectedWidth, 0)
})

test('clip block width doubles when BPM changes from 120 to 60', async ({ page }) => {
  await page.goto('/')

  const clip = page.locator('.midi-clip')
  const bpmInput = page.locator('.toolbar-bpm')

  await expect(clip).toBeVisible()
  const clipBox120 = await clip.boundingBox()

  await bpmInput.fill('60')
  await bpmInput.dispatchEvent('change')
  await page.waitForTimeout(100)

  const clipBox60 = await clip.boundingBox()
  expect(clipBox60).not.toBeNull()
  expect(clipBox120).not.toBeNull()

  const expectedWidth60 = clipDurationSeconds(60, 8) * getPixelsPerSecond(60)
  expect(clipBox60!.width).toBeCloseTo(expectedWidth60, 0)
  expect(clipBox60!.width).toBeCloseTo(clipBox120!.width * 2, 0)
})

test('clip block left edge aligns with bar 1 marker on ruler within 2px', async ({ page }) => {
  await page.goto('/')

  const clip = page.locator('.midi-clip')
  const rulerArea = page.locator('.timeline-ruler-area')
  const bar1 = page.locator('.timeline-ruler-bar[data-bar="1"]')
  const trackTimeline = page.locator('.track-timeline')

  await expect(clip).toBeVisible()
  await expect(bar1).toBeVisible()

  const clipBox = await clip.boundingBox()
  const rulerAreaBox = await rulerArea.boundingBox()
  const bar1Box = await bar1.boundingBox()
  const trackTimelineBox = await trackTimeline.boundingBox()

  expect(clipBox).not.toBeNull()
  expect(rulerAreaBox).not.toBeNull()
  expect(bar1Box).not.toBeNull()
  expect(trackTimelineBox).not.toBeNull()

  // Bar 1 left edge relative to ruler area (should be ~0)
  const bar1RelativeLeft = bar1Box!.x - rulerAreaBox!.x
  // Clip left edge relative to track timeline
  const clipRelativeLeft = clipBox!.x - trackTimelineBox!.x

  // Both should be at the same horizontal offset from their respective containers
  // which are aligned after the track header
  expect(Math.abs(clipRelativeLeft - bar1RelativeLeft)).toBeLessThanOrEqual(2)
})

test('loop region indicator appears when Loop is enabled and matches clip width', async ({ page }) => {
  await page.goto('/')

  const loopBtn = page.locator('.toolbar-loop')
  const clip = page.locator('.midi-clip')
  const rulerLoopRegion = page.locator('.timeline-loop-region')
  const trackLoopRegion = page.locator('.timeline-loop-region-track')

  await expect(loopBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(rulerLoopRegion).toBeVisible()
  await expect(trackLoopRegion).toBeVisible()

  await loopBtn.click()
  await expect(loopBtn).toHaveAttribute('aria-pressed', 'false')
  await expect(rulerLoopRegion).toHaveCount(0)
  await expect(trackLoopRegion).toHaveCount(0)

  await loopBtn.click()
  await expect(loopBtn).toHaveAttribute('aria-pressed', 'true')

  await expect(rulerLoopRegion).toBeVisible()
  await expect(trackLoopRegion).toBeVisible()

  const clipBox = await clip.boundingBox()
  const rulerRegionBox = await rulerLoopRegion.boundingBox()
  const trackRegionBox = await trackLoopRegion.boundingBox()

  expect(clipBox).not.toBeNull()
  expect(rulerRegionBox).not.toBeNull()
  expect(trackRegionBox).not.toBeNull()

  expect(Math.abs(rulerRegionBox!.width - clipBox!.width)).toBeLessThanOrEqual(2)
  expect(Math.abs(trackRegionBox!.width - clipBox!.width)).toBeLessThanOrEqual(2)
})

test('Master track is always visible regardless of track zone scroll position', async ({ page }) => {
  await page.goto('/')
  const masterTrack = page.locator('.master-track')
  const trackList = page.locator('.track-list')

  // Scroll the track list to the bottom
  await trackList.evaluate((el) => { el.scrollTop = el.scrollHeight })
  await expect(masterTrack).toBeVisible()

  // Scroll the track list to the top
  await trackList.evaluate((el) => { el.scrollTop = 0 })
  await expect(masterTrack).toBeVisible()
})
