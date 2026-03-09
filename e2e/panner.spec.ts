import { test, expect } from '@playwright/test'

test('open app, verify no AudioContext errors in console', async ({ page }) => {
  const consoleErrors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message)
  })

  await page.goto('/')

  // Wait for the app to stabilize
  await page.waitForTimeout(500)

  // Filter out known non-AudioContext errors if needed
  const audioContextErrors = consoleErrors.filter(
    (e) =>
      e.toLowerCase().includes('audiocontext') ||
      e.toLowerCase().includes('audio context')
  )

  expect(audioContextErrors).toHaveLength(0)
})
