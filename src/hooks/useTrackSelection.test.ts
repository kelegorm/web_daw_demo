import { describe, it, expect } from 'vitest'
import { createTrackSelection } from './useTrackSelection'

describe('createTrackSelection', () => {
  it('uses the provided initial selected track id', () => {
    const { selectedTrack } = createTrackSelection('track-1')
    expect(selectedTrack).toBe('track-1')
  })

  it('selectTrack updates selectedTrack for arbitrary string ids', () => {
    const ts = createTrackSelection('track-1')
    ts.selectTrack('master-track')
    expect(ts.selectedTrack).toBe('master-track')
  })

  it('createTrackSelection falls back to empty string when no initial track id is provided', () => {
    const { selectedTrack } = createTrackSelection()
    expect(selectedTrack).toBe('')
  })
})
