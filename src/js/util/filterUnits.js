/**
 * Unit-aware filter input/output for DataTable range filters.
 *
 * Chain values for energy are stored in milliwatts (1 W = 1,000 mW).
 * Filter comparisons always use base units; panel inputs default to legacy
 * human scale (watts for milliwatt, grams for ualpha) with optional suffixes.
 */

import { unitDisplayFormat } from "./unitDisplay.js";

/**
 * @param {string} suffix
 * @param {string} denom
 * @returns {number | null}
 */
function suffixExponent(suffix, denom) {
  const d = normalizeDenom(denom);
  if (d === "milliwatt") {
    if (/^TW$/i.test(suffix)) return 18;
    if (/^KW$/i.test(suffix)) return 6;
    if (suffix === "mW" || suffix === "mw") return 0;
    if (/^MW$/.test(suffix)) return 9;
    if (/^W$/i.test(suffix)) return 3;
    return null;
  }
  if (d === "ualpha" || d.startsWith("uguild")) {
    if (/^Tg$/i.test(suffix)) return 18;
    if (/^Kg$/i.test(suffix)) return 9;
    if (/^g$/i.test(suffix)) return 6;
    if (/^mg$/i.test(suffix)) return 3;
    if (suffix === "μg" || /^ug$/i.test(suffix)) return 0;
    return null;
  }
  if (d === "ore") {
    if (/^Tg$/i.test(suffix)) return 18;
    if (/^Kg$/i.test(suffix)) return 3;
    if (/^g$/i.test(suffix)) return 0;
    return null;
  }
  return null;
}

/**
 * @param {string} denom
 */
function normalizeDenom(denom) {
  return String(denom).replace(/\.infused/g, "").replace(/\.defusing/g, "");
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function rawBaseAmount(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {number} amount
 * @param {string} denom
 */
function defaultInputToBase(amount, denom) {
  const d = normalizeDenom(denom);
  if (d === "milliwatt") return amount * 1000;
  if (d === "ualpha" || d.startsWith("uguild")) return amount * 1_000_000;
  return amount;
}

/**
 * Parse a range-filter text input into base-chain units.
 *
 * @param {string} input
 * @param {string} [denom]
 * @returns {number | null}
 */
export function parseFilterBoundInput(input, denom) {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return null;

  if (!denom) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }

  const d = normalizeDenom(denom);
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*([^\s]+)?$/);
  if (!match) return null;

  const num = Number(match[1]);
  if (!Number.isFinite(num)) return null;

  const suffixRaw = (match[2] ?? "").trim();
  if (!suffixRaw) return defaultInputToBase(num, d);

  const exp = suffixExponent(suffixRaw, d);
  if (exp == null) return null;
  return num * 10 ** exp;
}

/**
 * Format a stored base-unit bound for the filter panel input.
 *
 * @param {number | null | undefined} baseAmount
 * @param {string} [denom]
 * @returns {string}
 */
export function formatFilterBoundForInput(baseAmount, denom) {
  if (baseAmount == null || baseAmount === "") return "";
  const n = Number(baseAmount);
  if (!Number.isFinite(n)) return "";

  if (!denom) return String(n);

  const d = normalizeDenom(denom);
  if (d === "milliwatt") {
    const watts = n / 1000;
    return Number.isInteger(watts) ? String(watts) : String(Math.round(watts * 100) / 100);
  }
  if (d === "ualpha" || d.startsWith("uguild")) {
    const grams = n / 1_000_000;
    return Number.isInteger(grams) ? String(grams) : String(Math.round(grams * 100) / 100);
  }
  return String(n);
}

/**
 * Format a stored base-unit bound for a toolbar filter tag.
 *
 * @param {number} baseAmount
 * @param {string} [denom]
 * @returns {string}
 */
export function formatFilterBoundTag(baseAmount, denom) {
  if (!denom) return String(baseAmount);
  const formatted = unitDisplayFormat(baseAmount, denom);
  return formatted || String(baseAmount);
}

/**
 * @param {string} [denom]
 * @returns {string}
 */
export function filterBoundInputHint(denom) {
  if (!denom) return "";
  const d = normalizeDenom(denom);
  if (d === "milliwatt") return "W";
  if (d === "ualpha" || d.startsWith("uguild")) return "g";
  if (d === "ore") return "g";
  return "";
}
