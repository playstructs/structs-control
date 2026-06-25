import { PfpClientRenderAttributes } from "../src/js/models/PfpClientRenderAttributes.js";
import { PfpViewer, pfpAvatar } from "../src/js/view_models/components/PfpViewer.js";
import { PFP_PART_COUNTS, PFP_PLACEHOLDER, PFP_ASSET_BASE } from "../src/js/constants/PfpConstants.js";

/**
 * @param {import("../src/js/framework/DTestFramework.js").DTestFramework} t
 */
export function pfpTests(t) {
  t.suite("Pfp", () => {
    t.it("fromJson parses a JSON string", () => {
      const a = PfpClientRenderAttributes.fromJson('{"head":1,"neck":2,"body":3,"arms":4,"background":5}');
      t.assert.truthy(a);
      t.assert.equal(a?.head, 1);
      t.assert.equal(a?.neck, 2);
      t.assert.equal(a?.body, 3);
      t.assert.equal(a?.arms, 4);
      t.assert.equal(a?.background, 5);
    });

    t.it("fromJson accepts a plain object", () => {
      const a = PfpClientRenderAttributes.fromJson({ head: 7 });
      t.assert.equal(a?.head, 7);
      t.assert.equal(a?.neck, null);
    });

    t.it("fromJson returns null for null / empty / garbage", () => {
      t.assert.equal(PfpClientRenderAttributes.fromJson(null), null);
      t.assert.equal(PfpClientRenderAttributes.fromJson(undefined), null);
      t.assert.equal(PfpClientRenderAttributes.fromJson(""), null);
      t.assert.equal(PfpClientRenderAttributes.fromJson("   "), null);
      t.assert.equal(PfpClientRenderAttributes.fromJson("not json"), null);
      t.assert.equal(PfpClientRenderAttributes.fromJson("123"), null);
    });

    t.it("renderHTML falls back to the placeholder when no attributes", () => {
      const html = new PfpViewer(null).renderHTML();
      t.assert.truthy(html.includes(PFP_PLACEHOLDER));
      t.assert.equal((html.match(/<img/g) || []).length, 1);
    });

    t.it("renderHTML stacks layers in back-to-front order", () => {
      const attrs = new PfpClientRenderAttributes(1, 2, 3, 4, 5);
      const html = new PfpViewer(attrs).renderHTML();
      const order = ["background", "arms", "body", "neck", "head"];
      let last = -1;
      for (const part of order) {
        const idx = html.indexOf(`${PFP_ASSET_BASE}/${part}/`);
        t.assert.truthy(idx > last);
        last = idx;
      }
      t.assert.equal((html.match(/<img/g) || []).length, 5);
    });

    t.it("renderHTML skips null layers", () => {
      const attrs = new PfpClientRenderAttributes(1, null, 3, null, 5);
      const html = new PfpViewer(attrs).renderHTML();
      t.assert.equal((html.match(/<img/g) || []).length, 3);
      t.assert.truthy(!html.includes("/neck/"));
      t.assert.truthy(!html.includes("/arms/"));
    });

    t.it("generateRandomPfp stays within PFP_PART_COUNTS", () => {
      for (let i = 0; i < 50; i++) {
        const p = new PfpViewer().generateRandomPfp();
        for (const part of Object.keys(PFP_PART_COUNTS)) {
          t.assert.truthy(p[part] >= 1);
          t.assert.truthy(p[part] <= PFP_PART_COUNTS[part]);
        }
      }
    });

    t.it("getPfpJson round-trips through fromJson", () => {
      const viewer = new PfpViewer(null, true);
      const json = viewer.getPfpJson();
      t.assert.truthy(typeof json === "string");
      const parsed = PfpClientRenderAttributes.fromJson(json);
      t.assert.deepEqual({ ...parsed }, { ...viewer.pfp });
    });

    t.it("getPfpJson is null without attributes", () => {
      t.assert.equal(new PfpViewer(null).getPfpJson(), null);
    });

    t.it("pfpAvatar wraps the picture in a sized container", () => {
      const html = pfpAvatar({ attributes: null, size: "lg" });
      t.assert.truthy(html.includes("sg-pfp"));
      t.assert.truthy(html.includes("sg-pfp--lg"));
      t.assert.truthy(html.includes(PFP_PLACEHOLDER));
    });

    t.it("pfpAvatar accepts a JSON string for attributes", () => {
      const html = pfpAvatar({ attributes: '{"head":1}', size: "sm" });
      t.assert.truthy(html.includes(`${PFP_ASSET_BASE}/head/pfp_head_1.png`));
    });
  });
}
