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

test('single Stop allows next Play to resume sequencing', async ({ page }) => {
  await page.goto('/')

  const playBtn = page.locator('.toolbar-play-pause')
  const stopBtn = page.locator('.toolbar-stop')

  await playBtn.click()
  await expect(playBtn).toHaveText('Pause')

  await page.waitForFunction(() => (window.__activeSteps ?? []).length >= 1, { timeout: 5000 })

  await stopBtn.click()
  await expect(playBtn).toHaveText('Play')

  const stepsAfterStop = await page.evaluate(() => (window.__activeSteps ?? []).length)

  await playBtn.click()
  await expect(playBtn).toHaveText('Pause')

  await page.waitForFunction(
    (prevLen) => (window.__activeSteps ?? []).length > prevLen,
    stepsAfterStop,
    { timeout: 5000 },
  )
})
