import { describe, it, expect } from 'vitest'
import {
  getPixelsPerSecond,
  barDurationSeconds,
  beatDurationSeconds,
  clipDurationSeconds,
} from './timelineScale'

describe('timelineScale', () => {
  it('getPixelsPerSecond(120) equals value used in timeline width calculation', () => {
    // The canonical value at 120 BPM is 60 px/s.
    // Any component using this for width/position must get the same number.
    expect(getPixelsPerSecond(120)).toBe(60)
  })

  it('barDurationSeconds(120) returns 2.0', () => {
    expect(barDurationSeconds(120)).toBe(2.0)
  })

  it('beatDurationSeconds(120) returns 0.5', () => {
    expect(beatDurationSeconds(120)).toBe(0.5)
  })

  it('clipDurationSeconds(120, 8) returns 2.0 (8 eighth notes at 120 BPM)', () => {
    expect(clipDurationSeconds(120, 8)).toBe(2.0)
  })
})
