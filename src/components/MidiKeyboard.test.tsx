import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import MidiKeyboard from './MidiKeyboard'
import type { ToneSynthHook } from '../hooks/useToneSynth'

function createSynthMock(): ToneSynthHook {
  return {
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    panic: vi.fn(),
    setFilterCutoff: vi.fn(),
    setVoiceSpread: vi.fn(),
    setVolume: vi.fn(),
    setEnabled: vi.fn(),
    getSynth: vi.fn(),
    getOutput: vi.fn(),
  } as unknown as ToneSynthHook
}

describe('MidiKeyboard', () => {
  let container: HTMLDivElement
  let root: Root
  let synth: ToneSynthHook

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    synth = createSynthMock()
  })

  afterEach(() => {
    root.unmount()
    container.remove()
  })

  it('keeps visual key press but does not send note commands when disabled', () => {
    flushSync(() => {
      root.render(<MidiKeyboard synth={synth} enabled={false} />)
    })

    const c3 = container.querySelector('.midi-keyboard [data-midi="48"]') as HTMLElement
    expect(c3).toBeTruthy()

    flushSync(() => {
      c3.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })

    expect(c3.className).toContain('pressed')
    expect(synth.noteOn).not.toHaveBeenCalled()
    expect(synth.noteOff).not.toHaveBeenCalled()

    flushSync(() => {
      c3.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    expect(c3.className).not.toContain('pressed')
    expect(synth.noteOn).not.toHaveBeenCalled()
    expect(synth.noteOff).not.toHaveBeenCalled()
  })

  it('releases active notes when rec is turned off', () => {
    flushSync(() => {
      root.render(<MidiKeyboard synth={synth} enabled={true} />)
    })

    const c3 = container.querySelector('.midi-keyboard [data-midi="48"]') as HTMLElement
    expect(c3).toBeTruthy()

    flushSync(() => {
      c3.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })

    expect(synth.noteOn).toHaveBeenCalledWith(48, 100)
    expect(c3.className).toContain('pressed')

    flushSync(() => {
      root.render(<MidiKeyboard synth={synth} enabled={false} />)
    })

    expect(synth.noteOff).toHaveBeenCalledWith(48)

    const c3AfterToggle = container.querySelector('.midi-keyboard [data-midi="48"]') as HTMLElement
    flushSync(() => {
      c3AfterToggle.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    })

    expect(synth.noteOff).toHaveBeenCalledTimes(1)
  })
})
