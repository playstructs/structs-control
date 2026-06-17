import {
  parseFilterBoundInput,
  formatFilterBoundForInput,
  formatFilterBoundTag,
  rawBaseAmount,
} from "../src/js/util/filterUnits.js";

/**
 * @param {import("../src/js/framework/DTestFramework.js").DTestFramework} t
 */
export function filterUnitsTests(t) {
  t.suite("filterUnits", () => {
    t.it("rawBaseAmount preserves milliwatt precision", () => {
      t.assert.equal(rawBaseAmount(42880000), 42880000);
      t.assert.equal(rawBaseAmount(null), null);
    });

    t.it("parseFilterBoundInput converts bare watts to milliwatts", () => {
      t.assert.equal(parseFilterBoundInput("50", "milliwatt"), 50000);
      t.assert.equal(parseFilterBoundInput("25", "milliwatt"), 25000);
    });

    t.it("parseFilterBoundInput accepts display suffixes", () => {
      t.assert.equal(parseFilterBoundInput("5KW", "milliwatt"), 5_000_000);
      t.assert.equal(parseFilterBoundInput("5W", "milliwatt"), 5000);
      t.assert.equal(parseFilterBoundInput("50mW", "milliwatt"), 50);
    });

    t.it("formatFilterBoundForInput shows watts in panel inputs", () => {
      t.assert.equal(formatFilterBoundForInput(50000, "milliwatt"), "50");
      t.assert.equal(formatFilterBoundForInput(50, "milliwatt"), "0.05");
    });

    t.it("formatFilterBoundTag matches table display scaling", () => {
      t.assert.equal(formatFilterBoundTag(50, "milliwatt"), "50mW");
      t.assert.equal(formatFilterBoundTag(5000, "milliwatt"), "5W");
      t.assert.equal(formatFilterBoundTag(5_000_000, "milliwatt"), "5KW");
    });
  });
}
