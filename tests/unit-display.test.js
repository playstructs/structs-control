import {
  unitDisplayFormat,
  unitLegacyFormat,
  formatGridAttribute,
  formatGridAttributeOrDash,
  formatUnitOrDash,
  formatUnitOrZero,
  coalesceNumeric,
} from "../src/js/util/unitDisplay.js";

/**
 * @param {import("../src/js/framework/DTestFramework.js").DTestFramework} t
 */
export function unitDisplayTests(t) {
  t.suite("unitDisplayFormat", () => {
    t.it("formats ualpha by magnitude", () => {
      t.assert.equal(unitDisplayFormat(50, "ualpha"), "50μg");
      t.assert.equal(unitDisplayFormat(5000, "ualpha"), "5mg");
      t.assert.equal(unitDisplayFormat(5_000_000, "ualpha"), "5g");
    });

    t.it("formats milliwatt by magnitude", () => {
      t.assert.equal(unitDisplayFormat(50, "milliwatt"), "50mW");
      t.assert.equal(unitDisplayFormat(5000, "milliwatt"), "5W");
      t.assert.equal(unitDisplayFormat(5_000_000, "milliwatt"), "5KW");
    });

    t.it("formats ore by magnitude", () => {
      t.assert.equal(unitDisplayFormat(50, "ore"), "50g");
      t.assert.equal(unitDisplayFormat(5000, "ore"), "5Kg");
    });

    t.it("strips infused/defusing suffixes from denom", () => {
      t.assert.equal(unitDisplayFormat(5_000_000, "ualpha.infused"), "5g");
    });

    t.it("formats uguild with token labels", () => {
      t.assert.equal(
        unitDisplayFormat(500, "uguild.0-1", { tokenSmall: "μTOK", tokenBig: "TOK" }),
        "500μTOK",
      );
      t.assert.equal(
        unitDisplayFormat(5_000_000, "uguild.0-1", { tokenSmall: "μTOK", tokenBig: "TOK" }),
        "5TOK",
      );
    });
  });

  t.suite("unitLegacyFormat", () => {
    t.it("scales ualpha and milliwatt to legacy units", () => {
      t.assert.equal(unitLegacyFormat(5_000_000, "ualpha"), 5);
      t.assert.equal(unitLegacyFormat(5000, "milliwatt"), 5);
      t.assert.equal(unitLegacyFormat(123, "ore"), 123);
    });
  });

  t.suite("grid attribute helpers", () => {
    t.it("formatGridAttribute maps attribute types to denoms", () => {
      t.assert.equal(formatGridAttribute("load", 5000), "5W");
      t.assert.equal(formatGridAttribute("ore", 50), "50g");
      t.assert.equal(formatGridAttribute("fuel", 5_000_000), "5g");
    });

    t.it("formatGridAttributeOrDash treats empty grid values as zero", () => {
      t.assert.equal(formatGridAttributeOrDash("capacity", null), "0mW");
      t.assert.equal(formatGridAttributeOrDash("load", ""), "0mW");
      t.assert.equal(formatGridAttributeOrDash("fuel", null), "0μg");
      t.assert.equal(formatGridAttributeOrDash("capacity", 5000), "5W");
    });

    t.it("formatUnitOrZero treats empty values as zero", () => {
      t.assert.equal(formatUnitOrZero(null, "ualpha"), "0μg");
      t.assert.equal(formatUnitOrZero(5_000_000, "ualpha"), "5g");
    });

    t.it("formatUnitOrDash handles empty values", () => {
      t.assert.equal(formatUnitOrDash(null, "ualpha"), "—");
      t.assert.equal(formatUnitOrDash(5_000_000, "ualpha"), "5g");
    });
  });
}
