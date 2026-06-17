import {
  applyFilters,
  filtersToTags,
  parseFiltersFromParams,
  serializeFiltersToParams,
  removeFilterTag,
} from "../src/js/util/tableFilters.js";
import { buildTableQuery, nextSortDirection, tableBindState } from "../src/js/util/bindDataTable.js";
import { rangeFilterField, checkboxFilterField, milliwattRangeField } from "../src/js/util/tableFilterSchemas.js";

const SCHEMA = [
  checkboxFilterField(
    "status",
    "Status",
    [
      { value: "online", label: "Online" },
      { value: "offline", label: "Offline" },
    ],
    (r) => r.status,
  ),
  rangeFilterField("energy", "Energy", (r) => r.energy),
];

const ROWS = [
  { id: "a", name: "Alice", status: "online", energy: 100 },
  { id: "b", name: "Bob", status: "offline", energy: 50 },
  { id: "c", name: "Carol", status: "online", energy: 200 },
];

/**
 * @param {import("../src/js/framework/DTestFramework.js").DTestFramework} t
 */
export function tableFiltersTests(t) {
  t.suite("tableFilters", () => {
    t.it("applyFilters checkbox AND range bounds", () => {
      const filtered = applyFilters(ROWS, { status: ["online"], energy: { min: 80, max: 150 } }, SCHEMA);
      t.assert.equal(filtered.length, 1);
      t.assert.equal(filtered[0].id, "a");
    });

    t.it("applyFilters range min only", () => {
      const filtered = applyFilters(ROWS, { energy: { min: 100 } }, SCHEMA);
      t.assert.equal(filtered.length, 2);
      t.assert.truthy(filtered.find((r) => r.id === "a"));
      t.assert.truthy(filtered.find((r) => r.id === "c"));
    });

    t.it("applyFilters compares milliwatt base units", () => {
      const schema = [milliwattRangeField("load", "Load", (r) => r.loadMw)];
      const rows = [
        { id: "a", loadMw: 0 },
        { id: "b", loadMw: 50000 },
        { id: "c", loadMw: 5_000_000 },
      ];
      const filtered = applyFilters(rows, { load: { max: 50000 } }, schema);
      t.assert.equal(filtered.length, 2);
      t.assert.truthy(filtered.find((r) => r.id === "a"));
      t.assert.truthy(filtered.find((r) => r.id === "b"));
    });

    t.it("filtersToTags formats energy labels with display units", () => {
      const schema = [milliwattRangeField("load", "Load", () => 0)];
      const tags = filtersToTags({ load: { max: 50000 } }, schema);
      t.assert.equal(tags.length, 1);
      t.assert.equal(tags[0].label, "Load Max: 50W");
    });

    t.it("filtersToTags formats labels", () => {
      const tags = filtersToTags({ status: ["online", "offline"], energy: { min: 10, max: 99 } }, SCHEMA);
      t.assert.equal(tags.length, 4);
      t.assert.equal(tags[0].label, "Status: Online");
      t.assert.equal(tags[1].label, "Status: Offline");
      t.assert.equal(tags[2].label, "Energy Min: 10");
      t.assert.equal(tags[3].label, "Energy Max: 99");
    });

    t.it("parseFiltersFromParams and serializeFiltersToParams round-trip", () => {
      const params = { f: "status:online,offline", "energy.min": "10", "energy.max": "99" };
      const filters = parseFiltersFromParams(params, "", SCHEMA);
      t.assert.deepEqual(filters.status, ["online", "offline"]);
      t.assert.equal(filters.energy.min, 10);
      t.assert.equal(filters.energy.max, 99);

      const serialized = serializeFiltersToParams(filters, SCHEMA);
      t.assert.equal(serialized.f, "status:online,offline");
      t.assert.equal(serialized["energy.min"], "10");
      t.assert.equal(serialized["energy.max"], "99");
    });

    t.it("parseFiltersFromParams respects prefix", () => {
      const params = { "y.f": "status:online", "y.energy.min": "5" };
      const filters = parseFiltersFromParams(params, "y.", SCHEMA);
      t.assert.deepEqual(filters.status, ["online"]);
      t.assert.equal(filters.energy.min, 5);
    });

    t.it("removeFilterTag removes checkbox value", () => {
      const next = removeFilterTag({ status: ["online", "offline"] }, "status:online");
      t.assert.deepEqual(next.status, ["offline"]);
    });

    t.it("removeFilterTag removes range bound", () => {
      const next = removeFilterTag({ energy: { min: 10, max: 99 } }, "energy.max");
      t.assert.equal(next.energy.min, 10);
      t.assert.equal(next.energy.max, undefined);
    });

    t.it("tableBindState reads prefixed sort, q, field, and page", () => {
      t.assert.deepEqual(tableBindState({ sort: "name:desc", q: "foo", field: "name", page: "2" }), {
        sort: "name:desc",
        q: "foo",
        field: "name",
        page: 2,
      });
      t.assert.deepEqual(tableBindState({ "n.sort": "id:asc", "n.q": "bar", "n.field": "id" }, "n."), {
        sort: "id:asc",
        q: "bar",
        field: "id",
        page: 1,
      });
    });

    t.it("nextSortDirection toggles asc and desc", () => {
      t.assert.equal(nextSortDirection(false, undefined), "asc");
      t.assert.equal(nextSortDirection(true, "asc"), "desc");
      t.assert.equal(nextSortDirection(true, "desc"), "asc");
    });

    t.it("buildTableQuery clears prefixed range params on filters null", () => {
      const schema = [rangeFilterField("load", "Load", () => 0)];
      const qs = buildTableQuery({ "n.load.max": "50", "y.q": "foo" }, { filters: null }, schema, "n.");
      t.assert.equal(qs, "y.q=foo");
    });

    t.it("buildTableQuery removes one range bound via tag removal", () => {
      const schema = [rangeFilterField("load", "Load", () => 0)];
      const qs = buildTableQuery(
        { "n.load.min": "10", "n.load.max": "50" },
        { filters: { load: { min: 10 } } },
        schema,
        "n.",
      );
      t.assert.equal(qs, "n.load.min=10");
    });

    t.it("column-scoped search matches selected field only", () => {
      const columns = [
        { id: "name", get: (r) => r.name },
        { id: "id", get: (r) => r.id },
      ];
      const query = "alice";
      const activeField = "name";
      const searchCol = columns.find((c) => c.id === activeField);
      const matched = ROWS.filter((row) =>
        String(searchCol.get(row) ?? "")
          .toLowerCase()
          .includes(query),
      );
      t.assert.equal(matched.length, 1);
      t.assert.equal(matched[0].name, "Alice");

      const wrongField = columns.find((c) => c.id === "id");
      const noMatch = ROWS.filter((row) =>
        String(wrongField.get(row) ?? "")
          .toLowerCase()
          .includes(query),
      );
      t.assert.equal(noMatch.length, 0);
    });
  });
}
