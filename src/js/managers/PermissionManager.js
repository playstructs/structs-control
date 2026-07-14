import { keys } from "../store/keys.js";
import { parsePermissionRecordId } from "../constants/Permissions.js";
import {
  buildPermissionGrantOnObject,
  buildPermissionRevokeOnObject,
  buildPermissionSetOnObject,
} from "../util/txMessages.js";

/**
 * @typedef {{
 *   permissionId: string,
 *   playerId: string,
 *   objectId: string,
 *   value: number,
 * }} ObjectPermissionRow
 */

export class PermissionManager {
  /**
   * @param {{ store: import("../store/Store.js").Store, guildAPI: import("../api/GuildAPI.js").GuildAPI }} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.guildAPI = deps.guildAPI;
  }

  /** @param {string} objectId */
  fetchByObject(objectId) {
    return this.store.query(keys.objectPermissions(objectId), () => this._loadByObject(objectId));
  }

  /**
   * @param {string} objectId
   * @returns {Promise<ObjectPermissionRow[]>}
   */
  async _loadByObject(objectId) {
    const rows = await this.guildAPI.getPermissionsByObject(objectId);
    const list = Array.isArray(rows) ? rows : [];
    /** @type {ObjectPermissionRow[]} */
    const out = [];
    for (const row of list) {
      const permissionId = String(row.permissionId ?? row.permission_id ?? "");
      const parsed = parsePermissionRecordId(permissionId);
      const playerId = parsed?.playerId ?? "";
      if (!permissionId || !playerId) continue;
      out.push({
        permissionId,
        playerId,
        objectId: parsed?.objectId ?? objectId,
        value: Number(row.value ?? row.permissions ?? 0) || 0,
      });
    }
    return out;
  }

  /**
   * @param {string} creator
   * @param {string} objectId
   * @param {string} playerId
   * @param {number} permissions
   */
  enqueueSet(creator, objectId, playerId, permissions) {
    const msg = buildPermissionSetOnObject({ creator, objectId, playerId, permissions });
    return this.store.tx?.enqueue(msg, {
      invalidate: [keys.objectPermissions(objectId)],
      optimisticPatch: (store) => this._patchMask(store, objectId, playerId, permissions),
    });
  }

  /**
   * @param {string} creator
   * @param {string} objectId
   * @param {string[]} playerIds
   * @param {number} permissions
   */
  enqueueSetMany(creator, objectId, playerIds, permissions) {
    return Promise.all(playerIds.map((playerId) => this.enqueueSet(creator, objectId, playerId, permissions)));
  }

  /**
   * @param {string} creator
   * @param {string} objectId
   * @param {string[]} playerIds
   * @param {number} bits
   */
  enqueueGrantMany(creator, objectId, playerIds, bits) {
    return Promise.all(
      playerIds.map((playerId) => {
        const msg = buildPermissionGrantOnObject({ creator, objectId, playerId, permissions: bits });
        return this.store.tx?.enqueue(msg, {
          invalidate: [keys.objectPermissions(objectId)],
          optimisticPatch: (store) => {
            const current = this._readMask(store, objectId, playerId);
            return this._patchMask(store, objectId, playerId, current | bits);
          },
        });
      }),
    );
  }

  /**
   * @param {string} creator
   * @param {string} objectId
   * @param {string[]} playerIds
   * @param {number} bits
   */
  enqueueRevokeMany(creator, objectId, playerIds, bits) {
    return Promise.all(
      playerIds.map((playerId) => {
        const msg = buildPermissionRevokeOnObject({ creator, objectId, playerId, permissions: bits });
        return this.store.tx?.enqueue(msg, {
          invalidate: [keys.objectPermissions(objectId)],
          optimisticPatch: (store) => {
            const current = this._readMask(store, objectId, playerId);
            return this._patchMask(store, objectId, playerId, current & ~bits);
          },
        });
      }),
    );
  }

  /**
   * @param {import("../store/Store.js").Store} store
   * @param {string} objectId
   * @param {string} playerId
   */
  _readMask(store, objectId, playerId) {
    const res = store.read(keys.objectPermissions(objectId));
    const rows = res.status === "success" && Array.isArray(res.data) ? res.data : [];
    const hit = rows.find((r) => String(r.playerId) === String(playerId));
    return Number(hit?.value ?? 0) || 0;
  }

  /**
   * @param {import("../store/Store.js").Store} store
   * @param {string} objectId
   * @param {string} playerId
   * @param {number} permissions
   * @returns {() => void}
   */
  _patchMask(store, objectId, playerId, permissions) {
    const key = keys.objectPermissions(objectId);
    const prev = store.read(key);
    if (prev.status !== "success" || !Array.isArray(prev.data)) return () => {};
    const next = prev.data.slice();
    const idx = next.findIndex((r) => String(r.playerId) === String(playerId));
    const row = {
      permissionId: `${objectId}@${playerId}`,
      playerId: String(playerId),
      objectId: String(objectId),
      value: Number(permissions) || 0,
    };
    if (idx >= 0) next[idx] = row;
    else next.push(row);
    store.write(key, { ...prev, data: next });
    return () => store.write(key, prev);
  }
}
