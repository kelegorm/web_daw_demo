import { test, expect } from '@playwright/test'

test('click Play, wait 1000ms at 120 BPM, verify at least 2 different step indicators highlighted', async ({ page }) => {
  await page.goto('/')

  // Click Play via toolbar
  const playBtn = page.locator('.toolbar-play-pause')
  await playBtn.click()
  await expect(playBtn).toHaveText('Pause')

  // Wait for at least 2 different step indicators to have been highlighted.
  // BPM=120, 8th note=250ms. Wait ~1000ms for 4 beats.
  await page.waitForFunction(
    () => {
      const steps = window.__activeSteps ?? []
      const unique = new Set(steps)
      return unique.size >= 2
    },
    { timeout: 5000 },
  )

  const activeSteps = await page.evaluate(() => window.__activeSteps ?? [])
  const uniqueSteps = new Set(activeSteps)
  expect(uniqueSteps.size).toBeGreaterThanOrEqual(2)

  // Click Pause
  await playBtn.click()
  await expect(playBtn).toHaveText('Play')
})
