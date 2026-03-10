import { describe, expect, it } from 'vitest'
import {
  computeGainReduction,
} from './gainReductionMath'

describe('computeGainReductionDb', () => {
  it('returns 3 dB when output is 3 dB quieter than input', () => {
    expect(computeGainReduction(0, -3)).toBe(3)
  })

  it('returns 0 when levels are equal', () => {
    expect(computeGainReduction(-12, -12)).toBe(0)
  })

  it('returns 0 when output is louder than input', () => {
    expect(computeGainReduction(-18, -12)).toBe(0)
  })

  it('returns positive reduction in dB when output is quieter', () => {
    expect(computeGainReduction(-17, -19)).toBe(2)
  })

  it('does not clamp large dB reductions', () => {
    expect(computeGainReduction(0, -24)).toBe(24)
  })

  it('returns 0 for non-finite input', () => {
    expect(computeGainReduction(Number.NaN, -3)).toBe(0)
    expect(computeGainReduction(0, Number.POSITIVE_INFINITY)).toBe(0)
  })
})
