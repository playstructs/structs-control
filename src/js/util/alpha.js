/**
 * Convert whole-alpha units to ualpha base units (× 1_000_000).
 * @param {string | number} alphaAmount
 * @returns {string}
 */
export function alphaToUalpha(alphaAmount) {
  return (BigInt(alphaAmount) * 1_000_000n).toString();
}
