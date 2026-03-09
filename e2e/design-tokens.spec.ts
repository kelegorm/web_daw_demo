import { test, expect } from '@playwright/test'

test('body background-color matches design token --color-bg (#1a1a1f)', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#root')).toBeVisible()

  const bgColor = await page.evaluate(() =>
    window.getComputedStyle(document.body).backgroundColor
  )

  // #1a1a1f in RGB is rgb(26, 26, 31)
  expect(bgColor).toBe('rgb(26, 26, 31)')
})
