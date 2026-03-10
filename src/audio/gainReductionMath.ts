export const GR_METER_RANGE_DB = 16
export const GR_METER_HEIGHT_PX = 60

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Computes normalized gain reduction from input/output signal levels in dB.
 *
 * Math:
 * - raw reduction in dB = max(0, inputDb - outputDb)
 * - normalized reduction = raw reduction / rangeDb
 * - final value is clamped to [0..1]
 *
 * Example:
 * - input = 0 dB, output = -3 dB, rangeDb = 16
 * - result = 3 / 16 = 0.1875
 *
 * @param inputDb Input signal level in dB.
 * @param outputDb Output signal level in dB.
 * @param rangeDb dB window that maps to full-scale meter (default 16 dB).
 * @returns Normalized gain reduction in [0..1].
 */
export function computeGainReduction(
  inputDb: number,
  outputDb: number,
  rangeDb = GR_METER_RANGE_DB,
): number {
  if (!Number.isFinite(inputDb) || !Number.isFinite(outputDb)) return 0
  if (!Number.isFinite(rangeDb) || rangeDb <= 0) return 0
  const deltaDb = Math.max(0, inputDb - outputDb)
  return clamp(deltaDb / rangeDb, 0, 1)
}

/**
 * Converts normalized gain reduction to bar height in pixels.
 *
 * Math:
 * - heightPx = clamp(reductionNorm, 0, 1) * meterHeightPx
 *
 * @param reductionNorm Normalized gain reduction in [0..1].
 * @param meterHeightPx Total visual meter height in pixels (default 60).
 * @returns Bar height in pixels in [0..meterHeightPx].
 */
export function gainReductionDbToPixels(
  reductionNorm: number,
  meterHeightPx = GR_METER_HEIGHT_PX,
): number {
  if (!Number.isFinite(reductionNorm) || reductionNorm <= 0) return 0
  if (!Number.isFinite(meterHeightPx) || meterHeightPx <= 0) return 0

  const norm = clamp(reductionNorm, 0, 1)
  return norm * meterHeightPx
}
