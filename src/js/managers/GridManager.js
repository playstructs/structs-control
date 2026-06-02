import { keys } from "../store/keys.js";
import { GRID_CATALOG_MAX_ROWS, normalizeGridRows, patchGridIndex } from "../util/gridIndex.js";
import { success } from "../store/Resource.js";

/** Freshness for the grid index comes from GRASS patches, not TTL refetch. */
const GRID_INDEX_STALE_TIME_MS = Number.POSITIVE_INFINITY;

export class GridManager {
  /**
   * @param {{ store: import("../store/Store.js").Store, guildAPI: import("../api/GuildAPI.js").GuildAPI }} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.guildAPI = deps.guildAPI;
  }

  fetchIndex() {
    return this.store.query(
      keys.gridIndex(),
      async () => {
        const rows = await this.guildAPI.getGridAll();
        if (rows.length >= GRID_CATALOG_MAX_ROWS) {
          console.warn(
            `[GridManager] grid catalog returned ${rows.length} rows (at or above cap ${GRID_CATALOG_MAX_ROWS}). Some grid data may be missing.`,
          );
        }
        return normalizeGridRows(rows);
      },
      { staleTime: GRID_INDEX_STALE_TIME_MS },
    );
  }

  /**
   * @param {string} objectId
   * @returns {import("../util/gridIndex.js").GridAttributesPartial}
   */
  getForObject(objectId) {
    const res = this.store.read(keys.gridIndex());
    if (res.status !== "success" || !res.data) return {};
    return /** @type {import("../util/gridIndex.js").GridIndex} */ (res.data)[String(objectId)] ?? {};
  }

  /**
   * Apply a GRASS grid update without refetching the full catalog.
   * @param {string} objectId
   * @param {string} attributeType
   * @param {number} value
   */
  patchAttribute(objectId, attributeType, value) {
    const key = keys.gridIndex();
    const current = this.store.read(key);
    const prev =
      current.status === "success" && current.data && typeof current.data === "object"
        ? /** @type {import("../util/gridIndex.js").GridIndex} */ (current.data)
        : {};
    const next = patchGridIndex(prev, objectId, attributeType, value);
    this.store.write(key, success(next));
  }
}
