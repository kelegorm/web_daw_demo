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

test('knob labels and values do not overflow device card bounds', async ({ page }) => {
  await page.goto('/')

  const devices = page.locator('.device')
  const deviceCount = await devices.count()
  expect(deviceCount).toBeGreaterThan(0)

  for (let i = 0; i < deviceCount; i++) {
    const device = devices.nth(i)
    await expect(device).toBeVisible()
    const deviceBox = await device.boundingBox()
    expect(deviceBox).not.toBeNull()
    if (!deviceBox) continue

    const textRows = device.locator('.knob-label, .knob-value')
    const textCount = await textRows.count()
    expect(textCount).toBeGreaterThan(0)

    for (let j = 0; j < textCount; j++) {
      const text = textRows.nth(j)
      await expect(text).toBeVisible()
      const textBox = await text.boundingBox()
      expect(textBox).not.toBeNull()
      if (!textBox) continue

      // Small epsilon for subpixel layout differences
      const eps = 0.75
      expect(textBox.x).toBeGreaterThanOrEqual(deviceBox.x - eps)
      expect(textBox.y).toBeGreaterThanOrEqual(deviceBox.y - eps)
      expect(textBox.x + textBox.width).toBeLessThanOrEqual(deviceBox.x + deviceBox.width + eps)
      expect(textBox.y + textBox.height).toBeLessThanOrEqual(deviceBox.y + deviceBox.height + eps)
    }
  }
})
