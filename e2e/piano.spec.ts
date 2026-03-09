import { test, expect } from '@playwright/test'

test('clicking middle C gives it the pressed CSS class', async ({ page }) => {
  await page.goto('/')

  // Middle C = C4 = MIDI 60
  const middleC = page.locator('[data-midi="60"]')
  await expect(middleC).toBeVisible()

  await middleC.dispatchEvent('mousedown')
  await expect(middleC).toHaveClass(/pressed/)

  await middleC.dispatchEvent('mouseup')
  await expect(middleC).not.toHaveClass(/pressed/)
})

test('mousedown on C3 fires noteOn(48), mouseup fires noteOff(48)', async ({ page }) => {
  await page.goto('/')

  // C3 = MIDI 48
  const c3 = page.locator('[data-midi="48"]')
  await expect(c3).toBeVisible()

  await c3.dispatchEvent('mousedown')
  const lastNoteOn = await page.evaluate(() => window.__lastNoteOn)
  expect(lastNoteOn).toBe(48)

  await c3.dispatchEvent('mouseup')
  const lastNoteOff = await page.evaluate(() => window.__lastNoteOff)
  expect(lastNoteOff).toBe(48)
})
