import { test, expect } from '@playwright/test'

test('drag Filter Cutoff knob upward increases displayed value', async ({ page }) => {
  await page.goto('/')

  const knob = page.locator('[data-testid="knob-filter-cutoff"] .knob')
  await expect(knob).toBeVisible()

  const valueEl = page.locator('[data-testid="knob-filter-cutoff"] .knob-value')
  const initialText = await valueEl.textContent()
  const initialValue = parseInt(initialText ?? '0')

  const box = await knob.boundingBox()
  if (!box) throw new Error('Knob bounding box not found')

  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx, cy - 60)
  await page.mouse.up()

  const newText = await valueEl.textContent()
  const newValue = parseInt(newText ?? '0')

  expect(newValue).toBeGreaterThan(initialValue)
})

test('drag Reverb Mix knob calls setParam with value in range 0-1', async ({ page }) => {
  await page.goto('/')

  const knob = page.locator('[data-testid="knob-reverb-mix"] .knob')
  await expect(knob).toBeVisible()

  const box = await knob.boundingBox()
  if (!box) throw new Error('Knob bounding box not found')

  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx, cy - 40)
  await page.mouse.up()

  const lastSetParam = await page.evaluate(() => window.__lastSetParam)
  expect(lastSetParam).not.toBeNull()
  expect(lastSetParam?.name).toBe('reverbMix')
  expect(lastSetParam?.value).toBeGreaterThanOrEqual(0)
  expect(lastSetParam?.value).toBeLessThanOrEqual(1)
})
