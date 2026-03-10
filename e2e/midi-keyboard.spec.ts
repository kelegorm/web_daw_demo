import { test, expect } from '@playwright/test'

test('mousedown on C3 gives it the pressed CSS class', async ({ page }) => {
  await page.goto('/')

  // C3 = MIDI 48, scoped to .midi-keyboard to avoid collision with PianoKeyboard
  const c3 = page.locator('.midi-keyboard [data-midi="48"]')
  await expect(c3).toBeVisible()

  await c3.dispatchEvent('mousedown')
  await expect(c3).toHaveClass(/pressed/)
})

test('mousedown on C3 and E3 simultaneously shows both pressed', async ({ page }) => {
  await page.goto('/')

  // C3 = MIDI 48, E3 = MIDI 52
  const c3 = page.locator('.midi-keyboard [data-midi="48"]')
  const e3 = page.locator('.midi-keyboard [data-midi="52"]')
  await expect(c3).toBeVisible()
  await expect(e3).toBeVisible()

  // Press C3, then press E3 without releasing C3
  await c3.dispatchEvent('mousedown')
  await e3.dispatchEvent('mousedown')

  await expect(c3).toHaveClass(/pressed/)
  await expect(e3).toHaveClass(/pressed/)
})

test('mouseup on C3 removes pressed from C3 but E3 retains it', async ({ page }) => {
  await page.goto('/')

  const c3 = page.locator('.midi-keyboard [data-midi="48"]')
  const e3 = page.locator('.midi-keyboard [data-midi="52"]')

  // Press both
  await c3.dispatchEvent('mousedown')
  await e3.dispatchEvent('mousedown')

  // Release C3 only
  await c3.dispatchEvent('mouseup')

  await expect(c3).not.toHaveClass(/pressed/)
  await expect(e3).toHaveClass(/pressed/)
})

test('at 1600px width keyboard element has fixed pixel width', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/')

  const keyboard = page.locator('.midi-keyboard')
  const box = await keyboard.boundingBox()
  expect(box).not.toBeNull()
  // 14 white keys × 40px = 560px
  expect(box!.width).toBeCloseTo(560, -1)
})

test('at 1600px width left and right gutter elements are visible', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/')

  const gutterLeft = page.getByTestId('keyboard-gutter-left')
  const gutterRight = page.getByTestId('keyboard-gutter-right')
  await expect(gutterLeft).toBeVisible()
  await expect(gutterRight).toBeVisible()

  const leftBox = await gutterLeft.boundingBox()
  const rightBox = await gutterRight.boundingBox()
  expect(leftBox!.width).toBeGreaterThan(0)
  expect(rightBox!.width).toBeGreaterThan(0)
})
