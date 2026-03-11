import { test, expect } from '@playwright/test'
import { expectPlayState, setBpm } from './helpers/toolbar'

test('transport buttons are positioned to the right of title and left of viewport center', async ({ page }) => {
  await page.goto('/')

  const title = page.locator('.toolbar-app-name')
  const playBtn = page.locator('.toolbar-play-pause')

  const titleBox = await title.boundingBox()
  const playBox = await playBtn.boundingBox()
  const viewportSize = page.viewportSize()

  expect(titleBox).not.toBeNull()
  expect(playBox).not.toBeNull()
  expect(viewportSize).not.toBeNull()

  // Play button starts to the right of the title's right edge
  expect(playBox!.x).toBeGreaterThan(titleBox!.x + titleBox!.width)
  // Play button center is left of viewport center
  const playCenter = playBox!.x + playBox!.width / 2
  expect(playCenter).toBeLessThan(viewportSize!.width / 2)
})

test('gap between title and first transport button is at least 32px', async ({ page }) => {
  await page.goto('/')

  const title = page.locator('.toolbar-app-name')
  const transport = page.locator('.toolbar-transport')

  const titleBox = await title.boundingBox()
  const transportBox = await transport.boundingBox()

  expect(titleBox).not.toBeNull()
  expect(transportBox).not.toBeNull()

  const gap = transportBox!.x - (titleBox!.x + titleBox!.width)
  expect(gap).toBeGreaterThanOrEqual(32)
})

test('click Play on toolbar changes button label to Pause', async ({ page }) => {
  await page.goto('/')

  const btn = page.locator('.toolbar-play-pause')
  await expect(btn).toBeVisible()
  await expectPlayState(btn, 'play')

  await btn.click()
  await expectPlayState(btn, 'pause')
})

test('change toolbar BPM input to 140, verify displayed value is 140', async ({ page }) => {
  await page.goto('/')

  await setBpm(page, 140)
  await expect(page.locator('.toolbar-bpm')).toHaveAttribute('aria-valuenow', '140')
})

test('click toolbar Panic releases all active notes', async ({ page }) => {
  await page.addInitScript(() => {
    const appWindow = window as Window & {
      __e2eHooksEnabled?: boolean
      __e2eHooks?: {
        sequencerTicks: number
        sequencerNoteOnSent: number
        sequencerNoteOffSent: number
        synthNoteOnReceived: number
        synthNoteOffReceived: number
        synthPanicReceived: number
      }
    }
    appWindow.__e2eHooksEnabled = true
    appWindow.__e2eHooks = {
      sequencerTicks: 0,
      sequencerNoteOnSent: 0,
      sequencerNoteOffSent: 0,
      synthNoteOnReceived: 0,
      synthNoteOffReceived: 0,
      synthPanicReceived: 0,
    }
  })

  await page.goto('/')

  const playBtn = page.locator('.toolbar-play-pause')
  await playBtn.click()
  await expectPlayState(playBtn, 'pause')
  await playBtn.click()
  await expectPlayState(playBtn, 'play')

  const c3 = page.locator('.midi-keyboard [data-midi="48"]')
  await expect(c3).toBeVisible()
  await c3.dispatchEvent('mousedown')
  await page.waitForFunction(() => (window.__vuMeterLevel ?? 0) > 0, { timeout: 500 })

  const panicCountBefore = await page.evaluate(() => {
    const appWindow = window as Window & {
      __e2eHooks?: { synthPanicReceived?: number }
    }
    return appWindow.__e2eHooks?.synthPanicReceived ?? 0
  })

  const panicBtn = page.locator('.toolbar-panic')
  await panicBtn.click()

  await page.waitForFunction((prev) => {
    const appWindow = window as Window & {
      __e2eHooks?: { synthPanicReceived?: number }
    }
    return (appWindow.__e2eHooks?.synthPanicReceived ?? 0) > prev
  }, panicCountBefore)

  await page.waitForFunction(() => (window.__vuMeterLevel ?? 0) < 0.001, { timeout: 2000 })
})
