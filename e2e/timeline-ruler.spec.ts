import { test, expect } from '@playwright/test'
import { getPixelsPerSecond, barDurationSeconds } from '../src/utils/timelineScale'
import { setBpm } from './helpers/toolbar'

test('timeline ruler is visible above track row', async ({ page }) => {
  await page.goto('/')
  const ruler = page.locator('.timeline-ruler')
  await expect(ruler).toBeVisible()
})

test('bar number "1" is visible in ruler at leftmost position', async ({ page }) => {
  await page.goto('/')

  const rulerArea = page.locator('.timeline-ruler-area')
  await expect(rulerArea).toBeVisible()

  const bar1 = page.locator('.timeline-ruler-bar[data-bar="1"]')
  await expect(bar1).toBeVisible()

  const rulerAreaBox = await rulerArea.boundingBox()
  const bar1Box = await bar1.boundingBox()

  expect(rulerAreaBox).not.toBeNull()
  expect(bar1Box).not.toBeNull()

  // Bar 1 should be at or very near the left edge of the ruler area
  const relativeLeft = bar1Box!.x - rulerAreaBox!.x
  expect(relativeLeft).toBeCloseTo(0, 0)
})

test('bar number "2" is visible at correct pixel offset for 120 BPM', async ({ page }) => {
  await page.goto('/')

  const rulerArea = page.locator('.timeline-ruler-area')
  const bar2 = page.locator('.timeline-ruler-bar[data-bar="2"]')

  await expect(bar2).toBeVisible()

  const rulerAreaBox = await rulerArea.boundingBox()
  const bar2Box = await bar2.boundingBox()

  expect(rulerAreaBox).not.toBeNull()
  expect(bar2Box).not.toBeNull()

  const expectedOffset = barDurationSeconds(120) * getPixelsPerSecond(120) // 120px
  const actualOffset = bar2Box!.x - rulerAreaBox!.x

  expect(actualOffset).toBeCloseTo(expectedOffset, 0)
})

test('change BPM to 60, verify bar "2" position has shifted right (wider bars)', async ({ page }) => {
  await page.goto('/')

  const rulerArea = page.locator('.timeline-ruler-area')
  const bar2 = page.locator('.timeline-ruler-bar[data-bar="2"]')

  // Get bar 2 position at 120 BPM
  await expect(bar2).toBeVisible()
  const rulerAreaBox120 = await rulerArea.boundingBox()
  const bar2Box120 = await bar2.boundingBox()
  const offset120 = bar2Box120!.x - rulerAreaBox120!.x

  // Change BPM to 60
  await setBpm(page, 60)
  await page.waitForTimeout(50)

  // Get bar 2 position at 60 BPM
  const rulerAreaBox60 = await rulerArea.boundingBox()
  const bar2Box60 = await bar2.boundingBox()
  const offset60 = bar2Box60!.x - rulerAreaBox60!.x

  const expectedOffset60 = barDurationSeconds(60) * getPixelsPerSecond(60) // 240px

  // Bar 2 should be further right at 60 BPM (wider bars)
  expect(offset60).toBeGreaterThan(offset120)
  expect(offset60).toBeCloseTo(expectedOffset60, 0)
})

test('3 beat tick marks are visible between bar 1 and bar 2', async ({ page }) => {
  await page.goto('/')

  // Beat ticks are inside bar 1's element (beats 1, 2, 3 within the bar)
  const bar1 = page.locator('.timeline-ruler-bar[data-bar="1"]')
  const beatTicks = bar1.locator('.timeline-ruler-beat')

  await expect(bar1).toBeVisible()
  await expect(beatTicks).toHaveCount(3)
})
