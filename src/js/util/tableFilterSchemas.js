/** Shared filter field builders for DataTable pages. */

import { GRID_ATTRIBUTE_DENOMS } from "./unitDisplay.js";
import { rawBaseAmount } from "./filterUnits.js";

/** @returns {import("./tableFilters.js").CheckboxFilterField} */
export function statusFilterField(getValue) {
  return {
    id: "status",
    label: "Status",
    type: "checkbox",
    options: [
      { value: "online", label: "Online" },
      { value: "offline", label: "Offline" },
      { value: "jailed", label: "Jailed" },
    ],
    getValue: (row) => {
      const raw = String(getValue(row) ?? "")
        .trim()
        .toLowerCase();
      if (raw.includes("jail")) return "jailed";
      if (raw.includes("offline") || raw === "false" || raw === "no" || raw === "inactive") return "offline";
      if (raw.includes("online") || raw === "true" || raw === "yes" || raw === "active") return "online";
      return raw || "offline";
    },
  };
}

/**
 * @param {string} id
 * @param {string} label
 * @param {(row: any) => number | null | undefined} getValue
 * @param {string} [denom]
 * @returns {import("./tableFilters.js").RangeFilterField}
 */
export function rangeFilterField(id, label, getValue, denom) {
  return { id, label, type: "range", getValue, ...(denom ? { denom } : {}) };
}

/**
 * Range filter for grid attributes stored in base chain units (e.g. milliwatt).
 *
 * @param {string} attributeType
 * @param {string} label
 * @param {(row: any) => unknown} getRawValue
 * @returns {import("./tableFilters.js").RangeFilterField}
 */
export function gridAttributeRangeField(attributeType, label, getRawValue) {
  const denom = GRID_ATTRIBUTE_DENOMS[attributeType] ?? undefined;
  return rangeFilterField(attributeType, label, (row) => rawBaseAmount(getRawValue(row)), denom);
}

/**
 * @param {(row: any) => unknown} getRawValue
 * @returns {import("./tableFilters.js").RangeFilterField}
 */
export function milliwattRangeField(id, label, getRawValue) {
  return rangeFilterField(id, label, (row) => rawBaseAmount(getRawValue(row)), "milliwatt");
}

/**
 * @param {string} id
 * @param {string} label
 * @param {Array<{ value: string, label: string }>} options
 * @param {(row: any) => string} getValue
 * @returns {import("./tableFilters.js").CheckboxFilterField}
 */
export function checkboxFilterField(id, label, options, getValue) {
  return { id, label, type: "checkbox", options, getValue };
}

/**
 * @param {any[]} rows
 * @param {(row: any) => string} getValue
 * @returns {Array<{ value: string, label: string }>}
 */
export function distinctCheckboxOptions(rows, getValue) {
  const seen = new Map();
  for (const row of rows) {
    const v = String(getValue(row) ?? "").trim();
    if (v && v !== "—") seen.set(v.toLowerCase(), v);
  }
  return [...seen.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
export function parseNumeric(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
