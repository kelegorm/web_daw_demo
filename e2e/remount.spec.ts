import { expect, test } from '@playwright/test'
import { expectPlayState } from './helpers/toolbar'

test('app remount does not duplicate sequencer activity', async ({ page }) => {
  await page.goto('/')

  const playBtn = page.locator('.toolbar-play-pause')
  await expect(playBtn).toBeVisible()

  const hasRemountHelper = await page.evaluate(() => {
    return typeof (window as Window & { __remountApp?: () => void }).__remountApp === 'function'
  })
  expect(hasRemountHelper).toBe(true)

  await playBtn.click()
  await expectPlayState(playBtn, 'pause')
  await page.waitForFunction(() => (window.__sequencerTicks ?? 0) >= 2, { timeout: 5000 })

  await page.evaluate(() => {
    const appWindow = window as Window & {
      __remountApp?: () => void
      __sequencerTicks?: number
      __activeSteps?: number[]
    }
    appWindow.__remountApp?.()
    appWindow.__sequencerTicks = 0
    appWindow.__activeSteps = []
  })

  await expect(page.locator('.toolbar')).toBeVisible()
  await expectPlayState(playBtn, 'play')

  await playBtn.click()
  await expectPlayState(playBtn, 'pause')
  await page.waitForTimeout(1200)

  const { ticks, uniqueSteps } = await page.evaluate(() => {
    const steps = window.__activeSteps ?? []
    return {
      ticks: window.__sequencerTicks ?? 0,
      uniqueSteps: new Set(steps).size,
    }
  })

  expect(ticks).toBeGreaterThanOrEqual(3)
  expect(ticks).toBeLessThanOrEqual(7)
  expect(uniqueSteps).toBeGreaterThanOrEqual(3)
  expect(uniqueSteps).toBeLessThanOrEqual(7)
})
