import { parseEntityId, isEntityId, entityRoute } from "../src/js/util/entityId.js";
import { buildEntityLookup, entityLabel } from "../src/js/util/entityLookup.js";
import { renderEntityRef } from "../src/js/util/entityLink.js";
import { Store } from "../src/js/store/Store.js";
import { keys } from "../src/js/store/keys.js";
import { success } from "../src/js/store/Resource.js";

/**
 * @param {import("../src/js/framework/DTestFramework.js").DTestFramework} t
 */
export function entityLinkTests(t) {
  t.suite("entityId", () => {
    t.it("detects type-index ids", () => {
      t.assert.truthy(isEntityId("1-11"));
      t.assert.falsy(isEntityId("player-1"));
      t.assert.falsy(isEntityId("structs1abc"));
    });

    t.it("parses type codes", () => {
      const p = parseEntityId("4-3");
      t.assert.equal(p?.typeCode, 4);
      t.assert.equal(p?.typeName, "Substation");
    });

    t.it("maps routes for known detail pages", () => {
      t.assert.equal(entityRoute("1-11"), "/players/1-11");
      t.assert.equal(entityRoute("3-1"), "/energy/reactors/3-1");
      t.assert.equal(entityRoute("6-1"), null);
    });
  });

  t.suite("entityLabel", () => {
    t.it("shows username (id) when player is cached", () => {
      const store = new Store();
      store.write(keys.guildRoster("0-1"), success([{ id: "1-11", name: "Ada" }]));
      store.session = /** @type {any} */ ({ data: { guildId: "0-1" } });
      const lookup = buildEntityLookup(store);
      t.assert.equal(entityLabel("1-11", lookup), "Ada (1-11)");
      t.assert.equal(entityLabel("1-99", lookup), "1-99");
    });
  });

  t.suite("renderEntityLink", () => {
    t.it("renders anchor for routable ids", () => {
      const html = renderEntityRef("3-1", null);
      t.assert.truthy(html.includes('href="/energy/reactors/3-1"'));
      t.assert.truthy(html.includes("data-spa-link"));
    });

    t.it("renders plain span for unknown types", () => {
      const html = renderEntityRef("6-1", null);
      t.assert.falsy(html.includes("<a "));
    });
  });
}
