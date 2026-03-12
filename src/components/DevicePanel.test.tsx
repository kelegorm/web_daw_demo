import * as React from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrackSelectionContext } from '../hooks/useTrackSelection'
import DevicePanel from './DevicePanel'

vi.mock('./SynthDevice', () => ({
  default: () => <div className="device synth-device" data-device-kind="SYNTH" />,
}))

vi.mock('./PannerDevice', () => ({
  default: () => <div className="device panner-device" data-device-kind="PANNER" />,
}))

vi.mock('./LimiterDevice', () => ({
  default: () => <div className="device limiter-device" data-device-kind="LIMITER" />,
}))

function makeSynthHook() {
  return {
    isEnabled: true,
    filterCutoff: 2000,
    voiceSpread: 0,
    volume: 0,
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    panic: vi.fn(),
    setFilterCutoff: vi.fn(),
    setVoiceSpread: vi.fn(),
    setVolume: vi.fn(),
    setEnabled: vi.fn(),
  }
}

function makePannerHook() {
  return {
    pan: 0,
    isEnabled: true,
    setPan: vi.fn(),
    setEnabled: vi.fn(),
  }
}

function makeLimiterHook() {
  return {
    isEnabled: true,
    threshold: -3,
    setThreshold: vi.fn(),
    setEnabled: vi.fn(),
    getReductionDb: vi.fn(() => 0),
    meterSource: { subscribe: vi.fn(() => vi.fn()) },
  }
}

describe('DevicePanel model-driven rendering', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    flushSync(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders selected regular-track devices by iterating the runtime device list', () => {
    flushSync(() => {
      root.render(
        <TrackSelectionContext.Provider
          value={{
            selectedTrack: 'synth1',
            selectTrack: vi.fn(),
          }}
        >
          <DevicePanel
            synth={makeSynthHook()}
            panner={makePannerHook()}
            limiter={makeLimiterHook()}
          />
        </TrackSelectionContext.Provider>,
      )
    })

    const kinds = Array.from(container.querySelectorAll('[data-device-kind]')).map((element) =>
      element.getAttribute('data-device-kind'),
    )

    expect(container.querySelector('.device-panel-track-name')?.textContent).toBe('synth1')
    expect(kinds).toEqual(['SYNTH', 'PANNER'])
    expect(container.querySelector('.synth-device')).toBeTruthy()
    expect(container.querySelector('.panner-device')).toBeTruthy()
    expect(container.querySelector('.limiter-device')).toBeNull()
  })

  it('renders selected master-track devices from UiPlan.masterTrack.devices', () => {
    flushSync(() => {
      root.render(
        <TrackSelectionContext.Provider
          value={{
            selectedTrack: 'master',
            selectTrack: vi.fn(),
          }}
        >
          <DevicePanel
            synth={makeSynthHook()}
            panner={makePannerHook()}
            limiter={makeLimiterHook()}
          />
        </TrackSelectionContext.Provider>,
      )
    })

    const kinds = Array.from(container.querySelectorAll('[data-device-kind]')).map((element) =>
      element.getAttribute('data-device-kind'),
    )

    expect(container.querySelector('.device-panel-track-name')?.textContent).toBe('Master')
    expect(kinds).toEqual(['LIMITER'])
    expect(container.querySelector('.synth-device')).toBeNull()
    expect(container.querySelector('.panner-device')).toBeNull()
    expect(container.querySelector('.limiter-device')).toBeTruthy()
  })
})
