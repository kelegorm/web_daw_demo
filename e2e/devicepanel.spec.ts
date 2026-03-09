import { test, expect } from '@playwright/test'

test('DevicePanel shows Polysynth and Panner labels', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.device-panel')).toBeVisible()

  const labels = page.locator('.device-label')
  const texts = await labels.allTextContents()
  expect(texts).toContain('Polysynth')
  expect(texts).toContain('Panner')
})

test('click Synth section disable toggle sets aria-pressed to false', async ({ page }) => {
  await page.goto('/')

  // The first .device-enable-toggle is in SynthDevice
  const synthToggle = page.locator('.synth-device .device-enable-toggle')
  await expect(synthToggle).toHaveAttribute('aria-pressed', 'true')

  await synthToggle.click()
  await expect(synthToggle).toHaveAttribute('aria-pressed', 'false')
})

test('drag Pan knob right increases displayed pan value', async ({ page }) => {
  await page.goto('/')

  const panKnob = page.locator('[data-testid="knob-pan"] .knob')
  await expect(panKnob).toBeVisible()

  const panValueEl = page.locator('[data-testid="knob-pan"] .knob-value')
  const initialText = await panValueEl.textContent()
  const initialVal = parseFloat(initialText ?? '0')

  // Drag upward (which increases value for the Knob component: dy = startY - currentY)
  const box = await panKnob.boundingBox()
  if (!box) throw new Error('knob bounding box not found')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 60)
  await page.mouse.up()

  const finalText = await panValueEl.textContent()
  const finalVal = parseFloat(finalText ?? '0')

  expect(finalVal).toBeGreaterThan(initialVal)
})
