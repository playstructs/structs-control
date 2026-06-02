import { formatCommissionPercent, formatCommissionPercentOrDash } from "../src/js/util/percentDisplay.js";

/**
 * @param {import("../src/js/framework/DTestFramework.js").DTestFramework} t
 */
export function percentDisplayTests(t) {
  t.suite("formatCommissionPercent", () => {
    t.it("formats decimal fractions", () => {
      t.assert.equal(formatCommissionPercent(0.04), "4%");
      t.assert.equal(formatCommissionPercent("0.040000000000000000"), "4%");
    });

    t.it("formats whole percents from player infusion API", () => {
      t.assert.equal(formatCommissionPercent(4), "4%");
    });

    t.it("treats null as zero percent", () => {
      t.assert.equal(formatCommissionPercent(null), "0%");
    });

    t.it("formatCommissionPercentOrDash keeps dash for missing optional fields", () => {
      t.assert.equal(formatCommissionPercentOrDash(null), "—");
      t.assert.equal(formatCommissionPercentOrDash(0.04), "4%");
    });
  });
}
