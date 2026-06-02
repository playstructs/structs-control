import { Store } from "../src/js/store/Store.js";
import { keys } from "../src/js/store/keys.js";
import { success } from "../src/js/store/Resource.js";
import {
  normalizeGridRows,
  patchGridIndex,
  objectIdFromGridSubject,
} from "../src/js/util/gridIndex.js";
import { GridManager } from "../src/js/managers/GridManager.js";

/**
 * @param {import("../src/js/framework/DTestFramework.js").DTestFramework} t
 */
export function gridIndexTests(t) {
  t.suite("gridIndex", () => {
    t.it("normalizeGridRows pivots flat rows into object map", () => {
      const index = normalizeGridRows([
        { object_id: "reactor-1", attribute_type: "capacity", val: 1000 },
        { object_id: "reactor-1", attribute_type: "load", val: 450 },
        { object_id: "player-2", attribute_type: "ore", val: 50 },
      ]);
      t.assert.equal(index["reactor-1"].capacity, 1000);
      t.assert.equal(index["reactor-1"].load, 450);
      t.assert.equal(index["player-2"].ore, 50);
    });

    t.it("patchGridIndex merges one attribute immutably", () => {
      const base = { "reactor-1": { capacity: 1000 } };
      const next = patchGridIndex(base, "reactor-1", "load", 200);
      t.assert.equal(base["reactor-1"].load, undefined);
      t.assert.equal(next["reactor-1"].capacity, 1000);
      t.assert.equal(next["reactor-1"].load, 200);
    });

    t.it("objectIdFromGridSubject parses GRASS subjects", () => {
      t.assert.equal(objectIdFromGridSubject("structs.grid.reactor.abc-123"), "abc-123");
      t.assert.equal(objectIdFromGridSubject("structs.grid.player.p-1"), "p-1");
      t.assert.equal(objectIdFromGridSubject("structs.player.updated"), null);
    });
  });

  t.suite("GridManager", () => {
    t.it("patchAttribute notifies grid index subscribers", () => {
      const store = new Store();
      const gridManager = new GridManager({ store, guildAPI: /** @type {any} */ ({}) });
      store.write(keys.gridIndex(), success({ "reactor-1": { capacity: 100 } }));

      let fired = 0;
      store.subscribe(keys.gridIndex(), () => fired++);

      gridManager.patchAttribute("reactor-1", "load", 42);

      t.assert.equal(fired, 1);
      t.assert.equal(gridManager.getForObject("reactor-1").capacity, 100);
      t.assert.equal(gridManager.getForObject("reactor-1").load, 42);
    });

    t.it("patchAttribute bootstraps index when empty", () => {
      const store = new Store();
      const gridManager = new GridManager({ store, guildAPI: /** @type {any} */ ({}) });

      gridManager.patchAttribute("sub-1", "capacity", 500);

      t.assert.equal(gridManager.getForObject("sub-1").capacity, 500);
      t.assert.equal(store.read(keys.gridIndex()).status, "success");
    });

    t.it("getForObject returns empty object when index not loaded", () => {
      const store = new Store();
      const gridManager = new GridManager({ store, guildAPI: /** @type {any} */ ({}) });
      t.assert.deepEqual(gridManager.getForObject("missing"), {});
    });
  });
}
