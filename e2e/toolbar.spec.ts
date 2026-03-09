import { test, expect } from '@playwright/test'

test('click Play on toolbar changes button label to Pause', async ({ page }) => {
  await page.goto('/')

  const btn = page.locator('.toolbar-play-pause')
  await expect(btn).toBeVisible()
  await expect(btn).toHaveText('Play')

  await btn.click()
  await expect(btn).toHaveText('Pause')
})

test('change toolbar BPM input to 140, verify displayed value is 140', async ({ page }) => {
  await page.goto('/')

  const bpmInput = page.locator('.toolbar-bpm')
  await expect(bpmInput).toBeVisible()

  await bpmInput.fill('140')
  await bpmInput.blur()

  await expect(bpmInput).toHaveValue('140')
})

test('click toolbar Panic releases all active notes', async ({ page }) => {
  await page.goto('/')

  // Reset panic count tracking
  await page.evaluate(() => { window.__panicCount = 0 })

  const panicBtn = page.locator('.toolbar-panic')
  await panicBtn.click()

  const panicCount = await page.evaluate(() => window.__panicCount)
  expect(panicCount).toBeGreaterThan(0)
})
