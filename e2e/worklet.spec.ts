import { test, expect } from '@playwright/test'

test('audioWorklet registers without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')

  const result = await page.evaluate(async () => {
    return await window.audioWorkletTest()
  })

  expect(result.success).toBe(true)
  expect(errors).toHaveLength(0)
})

test('worklet produces non-silent audio after noteOn', async ({ page }) => {
  await page.goto('/')

  const nonZero = await page.evaluate(async () => {
    await window.audioWorkletTest()

    const node = window.__synthNode!

    // Send noteOn then request a computed block from the WASM directly via port.
    // (AnalyserNode may not accumulate data in headless Chromium.)
    node.port.postMessage({ type: 'noteOn', note: 60 })

    const samples: number[] = await new Promise((resolve) => {
      node.port.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'output') resolve(e.data.samples as number[])
      }
      node.port.postMessage({ type: 'get-output' })
    })

    return samples.some((v) => Math.abs(v) > 0.001)
  })

  expect(nonZero).toBe(true)
})
