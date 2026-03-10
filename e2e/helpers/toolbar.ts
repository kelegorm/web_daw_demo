import { expect, type Locator, type Page } from '@playwright/test'

const MIN_BPM = 60
const MAX_BPM = 200

export async function expectPlayState(playButton: Locator, state: 'play' | 'pause') {
  const isPlaying = state === 'pause'
  await expect(playButton).toHaveAttribute('aria-label', isPlaying ? 'Pause' : 'Play')
  await expect(playButton).toHaveAttribute('aria-pressed', isPlaying ? 'true' : 'false')
}

export async function setBpm(page: Page, targetBpm: number) {
  const target = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(targetBpm)))
  const bpmDisplay = page.locator('.toolbar-bpm')
  await expect(bpmDisplay).toBeVisible()

  const currentAttr = await bpmDisplay.getAttribute('aria-valuenow')
  const current = Number(currentAttr)
  if (!Number.isFinite(current)) {
    throw new Error(`toolbar-bpm aria-valuenow is invalid: ${currentAttr}`)
  }
  if (current === target) return

  const box = await bpmDisplay.boundingBox()
  if (!box) throw new Error('toolbar-bpm has no bounding box')

  const diff = target - current
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY - diff * 2, {
    steps: Math.max(8, Math.min(30, Math.abs(diff))),
  })
  await page.mouse.up()

  await expect(bpmDisplay).toHaveAttribute('aria-valuenow', String(target))
}
