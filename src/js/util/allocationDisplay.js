/**
 * Display helpers for catalog allocation rows (Symfony `structs.allocation` columns).
 */

import { formatGridAttribute } from "./unitDisplay.js";

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

/**
 * Raw milliwatt power for an allocation from the grid index (`structs.grid.power`).
 * @param {string} id
 * @param {import("./gridIndex.js").GridIndex | null | undefined} gridIndex
 * @returns {number | undefined}
 */
export function allocationPowerRaw(id, gridIndex) {
  if (!id || !gridIndex) return undefined;
  const power = gridIndex[String(id)]?.power;
  return power == null ? undefined : Number(power);
}

/**
 * @param {unknown} row
 * @param {import("./gridIndex.js").GridIndex | null | undefined} gridIndex
 * @returns {string}
 */
export function formatAllocationPower(row, gridIndex) {
  const id = allocationId(row);
  const raw = allocationPowerRaw(id, gridIndex);
  return formatGridAttribute("power", raw);
}
