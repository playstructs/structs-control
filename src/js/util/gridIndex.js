/** @typedef {Record<string, number>} GridAttributesPartial */
/** @typedef {Record<string, GridAttributesPartial>} GridIndex */

/** Catalog pagination cap: 50 pages × 100 rows. */
export const GRID_CATALOG_MAX_ROWS = 5000;

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
    index[objectId][attributeType] = Number(row.val ?? 0);
  }
  return index;
}

/**
 * Merge a single attribute into an existing grid index (immutable copy).
 * @param {GridIndex} index
 * @param {string} objectId
 * @param {string} attributeType
 * @param {number} value
 * @returns {GridIndex}
 */
export function patchGridIndex(index, objectId, attributeType, value) {
  const id = String(objectId);
  const attr = String(attributeType);
  return {
    ...index,
    [id]: { ...(index[id] ?? {}), [attr]: value },
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
