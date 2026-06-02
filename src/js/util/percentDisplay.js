/**
 * Display helpers for commission and other percentage values.
 *
 * API shapes:
 * - Reactor catalog / chain: decimal fraction (0.04 = 4%)
 * - Player infusion bespoke GET: whole percent (4 = 4%) via floor(commission * 100)
 */

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function toCommissionNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Format a commission rate for display.
 * Auto-detects fractional (0–1] vs whole-percent (>1) inputs.
 * @param {unknown} value
 * @returns {string}
 */
export function formatCommissionPercent(value) {
  const n = toCommissionNumber(value);
  if (n == null) return "0%";

  let pct;
  if (n > 0 && n <= 1) {
    pct = Math.floor(n * 100);
  } else {
    pct = Math.floor(n);
  }

  return `${pct}%`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatCommissionPercentOrDash(value) {
  if (value == null || value === "") return "—";
  const n = toCommissionNumber(value);
  if (n == null) return "—";
  return formatCommissionPercent(n);
}
