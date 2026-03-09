import { test, expect } from '@playwright/test'

test('clicking Play changes button label to Pause', async ({ page }) => {
  await page.goto('/')

  const btn = page.locator('.transport-play-pause')
  await expect(btn).toBeVisible()
  await expect(btn).toHaveText('Play')

  await btn.click()
  await expect(btn).toHaveText('Pause')
})

test('clicking Pause after Play changes label back to Play', async ({ page }) => {
  await page.goto('/')

  const btn = page.locator('.transport-play-pause')
  await btn.click()
  await expect(btn).toHaveText('Pause')

  await btn.click()
  await expect(btn).toHaveText('Play')
})

test('clicking Panic increments panicCount and clears pressed piano keys', async ({ page }) => {
  await page.goto('/')

  // Press a piano key (target old PianoKeyboard component)
  const c3 = page.locator('.piano-keyboard [data-midi="48"]')
  await c3.dispatchEvent('mousedown')
  await expect(c3).toHaveClass(/pressed/)

  // Click Panic
  const panicBtn = page.locator('.transport-panic')
  await panicBtn.click()

  // Key should no longer appear pressed
  await expect(c3).not.toHaveClass(/pressed/)

  // panicCount should be > 0
  const panicCount = await page.evaluate(() => window.__panicCount)
  expect(panicCount).toBeGreaterThan(0)
})
