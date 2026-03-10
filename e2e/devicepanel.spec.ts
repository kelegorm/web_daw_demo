import { test, expect } from '@playwright/test'

test('DevicePanel shows Polysynth device when synth1 is selected', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.device-panel')).toBeVisible()

  // Click synth1 track row to select it
  const trackRow = page.locator('.track-row')
  await trackRow.click()

  const labels = page.locator('.device-label')
  const texts = await labels.allTextContents()
  expect(texts).toContain('Polysynth')
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

test('click synth1 row, Polysynth device is visible', async ({ page }) => {
  await page.goto('/')
  const trackRow = page.locator('.track-row')
  await trackRow.click()

  await expect(page.locator('.synth-device')).toBeVisible()
  const labels = page.locator('.device-label')
  const texts = await labels.allTextContents()
  expect(texts).toContain('Polysynth')
})

test('click Master row, Polysynth not visible and placeholder shown', async ({ page }) => {
  await page.goto('/')
  const masterTrack = page.locator('.master-track')
  await masterTrack.click()

  await expect(page.locator('.synth-device')).not.toBeVisible()
  await expect(page.locator('.device-panel-placeholder')).toBeVisible()
  const placeholderText = await page.locator('.device-panel-placeholder').textContent()
  expect(placeholderText).toContain('Limiter — coming soon')
})

test('panel label changes from synth1 to Master on track switch', async ({ page }) => {
  await page.goto('/')
  const trackName = page.locator('.device-panel-track-name')

  // Default is synth1 (text-transform: uppercase is CSS only; DOM content is lowercase)
  await expect(trackName).toHaveText('synth1')

  // Click Master track
  const masterTrack = page.locator('.master-track')
  await masterTrack.click()

  await expect(trackName).toHaveText('Master')
})
