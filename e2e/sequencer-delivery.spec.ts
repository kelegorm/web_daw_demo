import { expect, test } from '@playwright/test'
import { expectPlayState } from './helpers/toolbar'

type E2EHooksState = {
  sequencerTicks: number
  sequencerNoteOnSent: number
  sequencerNoteOffSent: number
  synthNoteOnReceived: number
  synthNoteOffReceived: number
  synthPanicReceived: number
}

test('one clip playback: sequencer sends 8 notes and synth receives all 8', async ({ page }) => {
  await page.addInitScript(() => {
    const appWindow = window as Window & {
      __e2eHooksEnabled?: boolean
      __e2eHooks?: E2EHooksState
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
  const loopBtn = page.locator('.toolbar-loop')

  await expect(playBtn).toBeVisible()
  if ((await loopBtn.getAttribute('aria-pressed')) !== 'false') {
    await loopBtn.click()
  }
  await expect(loopBtn).toHaveAttribute('aria-pressed', 'false')

  await page.evaluate(() => {
    const appWindow = window as Window & {
      __e2eHooks?: E2EHooksState
      __activeSteps?: number[]
    }
    appWindow.__activeSteps = []
    if (appWindow.__e2eHooks) {
      appWindow.__e2eHooks.sequencerTicks = 0
      appWindow.__e2eHooks.sequencerNoteOnSent = 0
      appWindow.__e2eHooks.sequencerNoteOffSent = 0
      appWindow.__e2eHooks.synthNoteOnReceived = 0
      appWindow.__e2eHooks.synthNoteOffReceived = 0
      appWindow.__e2eHooks.synthPanicReceived = 0
    }
  })

  await playBtn.click()
  await expectPlayState(playBtn, 'pause')

  await page.waitForFunction(() => {
    const hooks = (window as Window & { __e2eHooks?: E2EHooksState }).__e2eHooks
    return !!hooks && hooks.sequencerNoteOnSent >= 8 && hooks.synthNoteOnReceived >= 8
  }, { timeout: 7000 })

  await page.waitForTimeout(700)
  const firstSnapshot = await page.evaluate(() => {
    return (window as Window & { __e2eHooks?: E2EHooksState }).__e2eHooks!
  })

  await page.waitForTimeout(700)
  const secondSnapshot = await page.evaluate(() => {
    return (window as Window & { __e2eHooks?: E2EHooksState }).__e2eHooks!
  })

  expect(firstSnapshot.sequencerNoteOnSent).toBe(8)
  expect(firstSnapshot.sequencerNoteOffSent).toBe(8)
  expect(firstSnapshot.synthNoteOnReceived).toBe(8)
  expect(firstSnapshot.synthNoteOffReceived).toBe(8)

  expect(secondSnapshot.sequencerNoteOnSent).toBe(firstSnapshot.sequencerNoteOnSent)
  expect(secondSnapshot.sequencerNoteOffSent).toBe(firstSnapshot.sequencerNoteOffSent)
  expect(secondSnapshot.synthNoteOnReceived).toBe(firstSnapshot.synthNoteOnReceived)
  expect(secondSnapshot.synthNoteOffReceived).toBe(firstSnapshot.synthNoteOffReceived)
})
