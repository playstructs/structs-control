/**
 * Display helpers for catalog allocation rows (Symfony `structs.allocation` columns).
 */

/** @param {unknown} row */
export function allocationTypeLabel(row) {
  const t = /** @type {{ allocation_type?: string }} */ (row).allocation_type ?? "";
  const s = String(t).toLowerCase();
  if (!s) return "—";
  return s.replace(/_/g, " ");
}

/** @param {unknown} row */
export function allocationSourceId(row) {
  return /** @type {{ source_id?: string }} */ (row).source_id ?? "—";
}

/** @param {unknown} row */
export function allocationDestinationId(row) {
  return /** @type {{ destination_id?: string }} */ (row).destination_id ?? "—";
}

/** @param {unknown} row */
export function allocationControllerId(row) {
  return /** @type {{ controller?: string }} */ (row).controller ?? "—";
}

/** @param {unknown} row */
export function allocationId(row) {
  return /** @type {{ id?: string }} */ (row).id ?? "";
}
