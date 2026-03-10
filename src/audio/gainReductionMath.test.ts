import { describe, expect, it } from 'vitest'
import {
  computeGainReduction,
  gainReductionDbToPixels,
  GR_METER_HEIGHT_PX,
} from './gainReductionMath'

describe('computeGainReductionDb', () => {
  it('returns normalized value for 3 dB reduction in 16 dB window', () => {
    expect(computeGainReduction(0, -3, 16)).toBe(0.1875)
  })

  it('returns 0 when levels are equal', () => {
    expect(computeGainReduction(-12, -12)).toBe(0)
  })

  it('returns 0 when output is louder than input', () => {
    expect(computeGainReduction(-18, -12)).toBe(0)
  })

  it('clamps to 1 for reductions larger than range', () => {
    expect(computeGainReduction(0, -24, 16)).toBe(1)
  })

  it('returns 0 for non-finite input', () => {
    expect(computeGainReduction(Number.NaN, -3)).toBe(0)
    expect(computeGainReduction(0, Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('returns 0 for invalid range', () => {
    expect(computeGainReduction(0, -3, 0)).toBe(0)
  })
})

describe('gainReductionDbToPixels', () => {
  it('maps 0 normalized GR to 0 px', () => {
    expect(gainReductionDbToPixels(0)).toBe(0)
  })

  it('maps 0.5 normalized GR to half meter height', () => {
    expect(gainReductionDbToPixels(0.5, 60)).toBe(30)
  })

  it('maps 1 normalized GR to full meter height', () => {
    expect(gainReductionDbToPixels(1, GR_METER_HEIGHT_PX)).toBe(GR_METER_HEIGHT_PX)
  })

  it('clamps values above 1 to full meter height', () => {
    expect(gainReductionDbToPixels(1.5, 60)).toBe(60)
  })

  it('keeps proportional mapping for small positive normalized GR', () => {
    expect(gainReductionDbToPixels(0.1, 60)).toBe(6)
  })

  it('returns 0 for invalid meter height', () => {
    expect(gainReductionDbToPixels(0.5, 0)).toBe(0)
  })
})
