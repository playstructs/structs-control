import { AbstractGrassListener } from "../framework/AbstractGrassListener.js";
import { objectIdFromGridSubject } from "../util/gridIndex.js";

/**
 * Incrementally patch the grid index from GRASS grid events.
 * Subject: `structs.grid.{objectType}.{objectId}`; category = attribute name; value = new number.
 */
export class GridListener extends AbstractGrassListener {
  /**
   * @param {import("../managers/GridManager.js").GridManager} gridManager
   */
  constructor(gridManager) {
    super("GridListener");
    this.gridManager = gridManager;
  }

  /** @param {{ subject?: string, category?: string, value?: unknown }} data */
  handler(data) {
    const objectId = objectIdFromGridSubject(String(data?.subject ?? ""));
    if (!objectId || !data?.category) return;
    const value = Number(data.value);
    if (Number.isNaN(value)) return;
    this.gridManager.patchAttribute(objectId, String(data.category), value);
  }
}
