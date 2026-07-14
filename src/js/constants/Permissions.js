/**
 * Structs object-permission bit flags (25-bit mask).
 * @see https://structs.ai/knowledge/mechanics/permissions
 */

export const PERM = Object.freeze({
  PLAY: 1,
  ADMIN: 2,
  UPDATE: 4,
  DELETE: 8,
  TOKEN_TRANSFER: 16,
  TOKEN_INFUSE: 32,
  TOKEN_MIGRATE: 64,
  TOKEN_DEFUSE: 128,
  SOURCE_ALLOCATION: 256,
  GUILD_MEMBERSHIP: 512,
  SUBSTATION_CONNECTION: 1024,
  ALLOCATION_CONNECTION: 2048,
});

/**
 * Energy Permissions table columns (Figma 1342:32565).
 * @type {ReadonlyArray<{ id: string, label: string, bit: number }>}
 */
export const ENERGY_PERMISSION_COLUMNS = Object.freeze([
  { id: "play", label: "Play", bit: PERM.PLAY },
  { id: "update", label: "Update", bit: PERM.UPDATE },
  { id: "delete", label: "Delete", bit: PERM.DELETE },
  { id: "grid", label: "Grid", bit: PERM.SUBSTATION_CONNECTION },
  { id: "assets", label: "Assets", bit: PERM.SOURCE_ALLOCATION },
  { id: "associations", label: "Associations", bit: PERM.ALLOCATION_CONNECTION },
  { id: "permissions", label: "Permissions", bit: PERM.ADMIN },
]);

/** Mask of every Energy Permissions toggle column. */
export const ENERGY_PERMISSION_MASK = ENERGY_PERMISSION_COLUMNS.reduce((m, c) => m | c.bit, 0);

/**
 * @param {unknown} mask
 * @param {number} bit
 * @returns {boolean}
 */
export function hasPerm(mask, bit) {
  return (Number(mask) & bit) === bit;
}

/**
 * @param {unknown} mask
 * @param {number} bit
 * @param {boolean} on
 * @returns {number}
 */
export function setPerm(mask, bit, on) {
  const current = Number(mask) || 0;
  return on ? current | bit : current & ~bit;
}

/**
 * PermissionRecord id is `{objectId}@{playerId}`.
 * @param {string} objectId
 * @param {string} playerId
 */
export function permissionRecordId(objectId, playerId) {
  return `${objectId}@${playerId}`;
}

/**
 * @param {string} permissionId
 * @returns {{ objectId: string, playerId: string } | null}
 */
export function parsePermissionRecordId(permissionId) {
  const id = String(permissionId ?? "");
  const at = id.lastIndexOf("@");
  if (at <= 0) return null;
  return { objectId: id.slice(0, at), playerId: id.slice(at + 1) };
}
