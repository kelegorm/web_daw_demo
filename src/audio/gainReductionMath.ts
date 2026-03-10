export const GR_METER_RANGE_DB = 16
export const GR_METER_HEIGHT_PX = 60

/**
 * Computes gain reduction in dB from input/output signal levels in dB.
 *
 * Math:
 * - raw reduction in dB = max(0, inputDb - outputDb)
 *
 * Example:
 * - input = 0 dB, output = -3 dB
 * - result = 3
 *
 * @param inputDb Input signal level in dB.
 * @param outputDb Output signal level in dB.
 * @returns Gain reduction in dB (>= 0).
 */
export function computeGainReduction(
  inputDb: number,
  outputDb: number,
): number {
  if (!Number.isFinite(inputDb) || !Number.isFinite(outputDb)) return 0
  return Math.max(0, inputDb - outputDb)
}
