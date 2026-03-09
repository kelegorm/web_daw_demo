import { test, expect } from '@playwright/test'

test('app mounts without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')
  await expect(page.locator('#root')).toBeVisible()

  expect(errors).toHaveLength(0)
})
