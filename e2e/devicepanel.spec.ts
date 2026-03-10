import { test, expect, Page } from '@playwright/test'

async function dragKnobBy(page: Page, selector: string, dy: number) {
  const knob = page.locator(selector)
  await expect(knob).toBeVisible()
  const box = await knob.boundingBox()
  if (!box) throw new Error('knob bounding box not found')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + dy)
  await page.mouse.up()
}

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

test('double-click resets synth and panner knobs to defaults', async ({ page }) => {
  await page.goto('/')

  await dragKnobBy(page, '[data-testid="knob-filter-cutoff"] .knob', -40)
  await page.locator('[data-testid="knob-filter-cutoff"] .knob').dblclick()
  await expect(page.locator('[data-testid="knob-filter-cutoff"] .knob-value')).toHaveText('2.0k')

  await dragKnobBy(page, '[data-testid="knob-voice-spread"] .knob', -40)
  await page.locator('[data-testid="knob-voice-spread"] .knob').dblclick()
  await expect(page.locator('[data-testid="knob-voice-spread"] .knob-value')).toHaveText('0.00')

  await dragKnobBy(page, '[data-testid="knob-volume"] .knob', -40)
  await page.locator('[data-testid="knob-volume"] .knob').dblclick()
  await expect(page.locator('[data-testid="knob-volume"] .knob-value')).toHaveText('0dB')

  await dragKnobBy(page, '[data-testid="knob-pan"] .knob', -40)
  await page.locator('[data-testid="knob-pan"] .knob').dblclick()
  await expect(page.locator('[data-testid="knob-pan"] .knob-value')).toHaveText('0.00')
})

test('double-click resets limiter threshold knob to default', async ({ page }) => {
  await page.goto('/')
  await page.locator('.master-track').click()

  await dragKnobBy(page, '[data-testid="knob-limiter-threshold"] .knob', -40)
  await page.locator('[data-testid="knob-limiter-threshold"] .knob').dblclick()
  await expect(page.locator('[data-testid="knob-limiter-threshold"] .knob-value')).toHaveText('-3dB')
})

test('Limiter GR meter shows gain reduction while playing with low threshold', async ({ page }) => {
  await page.goto('/')

  await dragKnobBy(page, '[data-testid="knob-volume"] .knob', -40)
  await page.locator('.master-track').click()
  await dragKnobBy(page, '[data-testid="knob-limiter-threshold"] .knob', 90)
  await page.locator('.toolbar-play-pause').click()

  const grMeter = page.locator('.limiter-gr-meter')
  await expect.poll(async () => {
    const title = await grMeter.getAttribute('title')
    const match = title?.match(/-([\d.]+) dB/)
    return match ? Number(match[1]) : 0
  }).toBeGreaterThan(0.2)
})

test('Pan knob keeps value after switching to Master and back', async ({ page }) => {
  await page.goto('/')

  const panKnob = page.locator('[data-testid="knob-pan"] .knob')
  const panValueEl = page.locator('[data-testid="knob-pan"] .knob-value')
  await expect(panKnob).toBeVisible()

  const box = await panKnob.boundingBox()
  if (!box) throw new Error('knob bounding box not found')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40)
  await page.mouse.up()

  const beforeSwitch = parseFloat((await panValueEl.textContent()) ?? '0')

  await page.locator('.master-track').click()
  await page.locator('.track-row').click()

  const afterSwitch = parseFloat((await panValueEl.textContent()) ?? '0')
  expect(afterSwitch).toBe(beforeSwitch)
})

test('synth volume knob starts at 0 dB', async ({ page }) => {
  await page.goto('/')

  const volumeValueEl = page.locator('[data-testid="knob-volume"] .knob-value')
  await expect(volumeValueEl).toHaveText('0dB')
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

test('click Master row, Polysynth not visible and Limiter label is shown', async ({ page }) => {
  await page.goto('/')
  const masterTrack = page.locator('.master-track')
  await masterTrack.click()

  await expect(page.locator('.synth-device')).not.toBeVisible()
  await expect(page.locator('.limiter-device')).toBeVisible()
  const labels = page.locator('.device-label')
  const texts = await labels.allTextContents()
  expect(texts).toContain('Limiter')
})

test('click Master row, Limiter label visible and placeholder is gone', async ({ page }) => {
  await page.goto('/')
  const masterTrack = page.locator('.master-track')
  await masterTrack.click()

  await expect(page.locator('.limiter-device')).toBeVisible()
  const labels = page.locator('.device-label')
  const texts = await labels.allTextContents()
  expect(texts).toContain('Limiter')
  await expect(page.locator('.device-panel-placeholder')).not.toBeVisible()
})

test('drag Threshold knob on Master track changes displayed value', async ({ page }) => {
  await page.goto('/')
  const masterTrack = page.locator('.master-track')
  await masterTrack.click()

  const thresholdKnob = page.locator('[data-testid="knob-limiter-threshold"] .knob')
  await expect(thresholdKnob).toBeVisible()

  const valueEl = page.locator('[data-testid="knob-limiter-threshold"] .knob-value')
  const initialText = await valueEl.textContent()
  const initialVal = parseFloat(initialText ?? '0')

  const box = await thresholdKnob.boundingBox()
  if (!box) throw new Error('knob bounding box not found')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 60)
  await page.mouse.up()

  const finalText = await valueEl.textContent()
  const finalVal = parseFloat(finalText ?? '0')
  expect(finalVal).toBeGreaterThan(initialVal)
})

test('Limiter input threshold marker moves when Threshold knob changes', async ({ page }) => {
  await page.goto('/')
  await page.locator('.master-track').click()

  const marker = page.locator('.limiter-input-threshold-line')
  await expect(marker).toBeVisible()

  const readBottomPercent = async () => {
    const style = await marker.getAttribute('style')
    const match = style?.match(/bottom:\s*calc\(([\d.]+)% - 1px\)/)
    return match ? Number(match[1]) : 0
  }

  const initialBottom = await readBottomPercent()
  await dragKnobBy(page, '[data-testid="knob-limiter-threshold"] .knob', -60)

  await expect.poll(async () => readBottomPercent()).toBeGreaterThan(initialBottom + 1)
})

test('click synth1 then Master, Limiter visible and Polysynth not visible', async ({ page }) => {
  await page.goto('/')
  const trackRow = page.locator('.track-row')
  await trackRow.click()
  await expect(page.locator('.synth-device')).toBeVisible()

  const masterTrack = page.locator('.master-track')
  await masterTrack.click()

  await expect(page.locator('.limiter-device')).toBeVisible()
  await expect(page.locator('.synth-device')).not.toBeVisible()
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
