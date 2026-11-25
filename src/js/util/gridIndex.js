/** Exact decimal string or number; prefer strings for uint64 wire values. */
/** @typedef {Record<string, string | number>} GridAttributesPartial */
/** @typedef {Record<string, GridAttributesPartial>} GridIndex */

/** Catalog pagination cap: 50 pages × 100 rows. */
export const GRID_CATALOG_MAX_ROWS = 5000;

/**
 * Keep catalog grid values as exact decimal strings when possible (v0.22 uint64).
 * @param {unknown} val
 * @returns {string | number}
 */
function exactGridValue(val) {
  if (val == null || val === "") return "0";
  if (typeof val === "string" && /^(0|[1-9][0-9]*)$/.test(val)) return val;
  if (typeof val === "number" && Number.isSafeInteger(val)) return String(val);
  const n = Number(val);
  return Number.isFinite(n) ? n : "0";
}

/**
 * Pivot flat grid catalog rows into an object-id → attributes map.
 * @param {import("../types/api.js").GridRow[]} rows
 * @returns {GridIndex}
 */
export function normalizeGridRows(rows) {
  /** @type {GridIndex} */
  const index = {};
  for (const row of rows) {
    const objectId = String(row.object_id ?? "");
    const attributeType = String(row.attribute_type ?? "");
    if (!objectId || !attributeType) continue;
    if (!index[objectId]) index[objectId] = {};
    index[objectId][attributeType] = exactGridValue(row.val);
  }
  return index;
}

/**
 * Merge a single attribute into an existing grid index (immutable copy).
 * @param {GridIndex} index
 * @param {string} objectId
 * @param {string} attributeType
 * @param {string | number} value
 * @returns {GridIndex}
 */
export function patchGridIndex(index, objectId, attributeType, value) {
  const id = String(objectId);
  const attr = String(attributeType);
  return {
    ...index,
    [id]: { ...(index[id] ?? {}), [attr]: exactGridValue(value) },
  };
}

/**
 * Parse object id from a GRASS grid subject (`structs.grid.{type}.{id}`).
 * @param {string} subject
 * @returns {string | null}
 */
export function objectIdFromGridSubject(subject) {
  if (typeof subject !== "string" || !subject.startsWith("structs.grid.")) return null;
  const rest = subject.slice("structs.grid.".length);
  const dotIdx = rest.indexOf(".");
  if (dotIdx === -1) return null;
  const objectId = rest.slice(dotIdx + 1);
  return objectId || null;
}
