/**
 * Client-side mirror of PostgreSQL `structs.UNIT_DISPLAY_FORMAT` and
 * `structs.UNIT_LEGACY_FORMAT` (structs-pg function-unit-display-format).
 */

/** @typedef {{ tokenSmall?: string, tokenBig?: string }} GuildDenomLabels */

/** Grid attribute_type → base denom for display scaling. */
export const GRID_ATTRIBUTE_DENOMS = Object.freeze({
  ore: "ore",
  fuel: "ualpha",
  capacity: "milliwatt",
  load: "milliwatt",
  structsLoad: "milliwatt",
  power: "milliwatt",
  connectionCapacity: "milliwatt",
  connectionCount: "milliwatt",
  allocationPointerStart: "milliwatt",
  allocationPointerEnd: "milliwatt",
});

/**
 * @param {unknown} amount
 * @returns {number}
 */
function toAmountNumber(amount) {
  if (amount == null || amount === "") return NaN;
  const n = Number(amount);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Digit length of floor(abs(amount)), matching PostgreSQL LENGTH(floor(_amount)::varchar).
 * @param {number} amount
 */
function floorDigitLength(amount) {
  return String(Math.floor(Math.abs(amount))).length;
}

/**
 * @param {string} denom
 */
function normalizeDenom(denom) {
  return String(denom).replace(/\.infused/g, "").replace(/\.defusing/g, "");
}

/**
 * @param {number} amount
 * @param {number} exp
 */
function scaledAmount(amount, exp) {
  const scaled = amount / 10 ** exp;
  return String(Math.round(scaled * 100) / 100);
}

/**
 * Display-format a base-unit amount (ualpha, uguild.*, milliwatt, ore).
 * @param {unknown} amount
 * @param {string} denom
 * @param {GuildDenomLabels} [guildDenoms] token labels for uguild.* denoms
 * @returns {string}
 */
export function unitDisplayFormat(amount, denom, guildDenoms = {}) {
  const value = toAmountNumber(amount);
  if (Number.isNaN(value)) return "";

  let d = normalizeDenom(denom);

  if (d === "ualpha") {
    const len = floorDigitLength(value);
    const exp =
      len >= 16 ? 18 : len >= 10 ? 9 : len >= 6 ? 6 : len >= 3 ? 3 : 0;
    const postfix = { 18: "Tg", 9: "Kg", 6: "g", 3: "mg", 0: "μg" }[exp];
    return `${scaledAmount(value, exp)}${postfix}`;
  }

  if (d.startsWith("uguild")) {
    const len = floorDigitLength(value);
    const exp = len >= 6 ? 6 : 0;
    const fallback =
      exp === 6
        ? d.length > 1
          ? d.slice(1, d.length - 1)
          : d
        : d;
    const postfix =
      exp === 6
        ? guildDenoms.tokenBig ?? fallback
        : guildDenoms.tokenSmall ?? d;
    return `${scaledAmount(value, exp)}${postfix}`;
  }

  if (d === "milliwatt") {
    const len = floorDigitLength(value);
    const exp =
      len >= 16 ? 18 : len >= 10 ? 9 : len >= 6 ? 6 : len >= 3 ? 3 : 0;
    const postfix = { 18: "TW", 9: "MW", 6: "KW", 3: "W", 0: "mW" }[exp];
    return `${scaledAmount(value, exp)}${postfix}`;
  }

  if (d === "ore") {
    const len = floorDigitLength(value);
    const exp = len >= 12 ? 18 : len >= 4 ? 3 : 0;
    const postfix = { 18: "Tg", 3: "Kg", 0: "g" }[exp];
    return `${scaledAmount(value, exp)}${postfix}`;
  }

  return String(value);
}

/**
 * Legacy whole-number display (pre-scaled units for UI that expects grams/watts/alpha).
 * @param {unknown} amount
 * @param {string} denom
 * @returns {number | null}
 */
export function unitLegacyFormat(amount, denom) {
  const value = toAmountNumber(amount);
  if (Number.isNaN(value)) return null;

  const d = normalizeDenom(denom);

  if (d === "ualpha" || d.startsWith("uguild")) {
    return Math.floor(value / 1_000_000);
  }
  if (d === "milliwatt") {
    return Math.floor(value / 1_000);
  }
  if (d === "ore") {
    return value;
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number}
 */
export function coalesceNumeric(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resolve the base denom for a grid attribute_type.
 * @param {string} attributeType
 * @returns {string | null}
 */
export function gridAttributeDenom(attributeType) {
  return GRID_ATTRIBUTE_DENOMS[String(attributeType)] ?? null;
}

/**
 * Format a grid attribute value with the correct unit scaling.
 * @param {string} attributeType
 * @param {unknown} value
 * @param {GuildDenomLabels} [guildDenoms]
 * @returns {string}
 */
export function formatGridAttribute(attributeType, value, guildDenoms) {
  const denom = gridAttributeDenom(attributeType);
  if (!denom) return value == null || value === "" ? "" : String(value);
  return unitDisplayFormat(coalesceNumeric(value), denom, guildDenoms);
}

/**
 * Format an amount for display, or em dash when empty/invalid.
 * @param {unknown} amount
 * @param {string} denom
 * @param {GuildDenomLabels} [guildDenoms]
 * @returns {string}
 */
export function formatUnitOrDash(amount, denom, guildDenoms) {
  if (amount == null || amount === "") return "—";
  const formatted = unitDisplayFormat(amount, denom, guildDenoms);
  return formatted || "—";
}

/**
 * Format a grid-scaled amount; null/empty values display as zero.
 * @param {unknown} amount
 * @param {string} denom
 * @param {GuildDenomLabels} [guildDenoms]
 * @returns {string}
 */
export function formatUnitOrZero(amount, denom, guildDenoms) {
  return unitDisplayFormat(coalesceNumeric(amount), denom, guildDenoms);
}

/**
 * Format a grid attribute for display. Missing values are treated as zero.
 * @param {string} attributeType
 * @param {unknown} value
 * @param {GuildDenomLabels} [guildDenoms]
 * @returns {string}
 */
export function formatGridAttributeOrDash(attributeType, value, guildDenoms) {
  const formatted = formatGridAttribute(attributeType, value, guildDenoms);
  return formatted || "—";
}
