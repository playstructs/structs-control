import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { keys } from "../store/keys.js";
import { bindDataTable, gotoTableState, tableBindState } from "../util/bindDataTable.js";
import { parseFiltersFromParams, parseTableParams } from "../util/tableFilters.js";
import { milliwattRangeField, parseNumeric, rangeFilterField } from "../util/tableFilterSchemas.js";
import { formatGridAttributeOrDash } from "../util/unitDisplay.js";

/** @param {import("../managers/GridManager.js").GridManager} gridManager */
function substationsFilterSchema(gridManager) {
  return [
    milliwattRangeField("capacity", "Capacity", (r) => {
      const grid = gridManager.getForObject(r.id);
      return grid.capacity ?? r.capacity;
    }),
    milliwattRangeField("load", "Load", (r) => {
      const grid = gridManager.getForObject(r.id);
      return grid.load ?? r.load;
    }),
    rangeFilterField("players", "Players", (r) => parseNumeric(r.player_count)),
  ];
}
import { buildEntityLookup } from "../util/entityLookup.js";
import { renderEntityLink } from "../util/entityLink.js";

export class SubstationsController extends AbstractController {
  constructor(deps) {
    super("Substations", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.substationManager = deps.substationManager;
    this.gridManager = deps.gridManager;
  }

  activate(_page, params) {
    void this.substationManager.fetchList();
    this.layout.mountContent(
      new SubstationsListViewModel({
        store: this.store,
        router: this.router,
        params: params ?? {},
        gridManager: this.gridManager,
      }),
    );
  }
}

class SubstationsListViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.params = deps.params;
    this.gridManager = deps.gridManager;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.substationList());
    this.subscribe(this.store, keys.gridIndex());
  }

  render() {
    const list = this.store.read(keys.substationList());
    const lookup = buildEntityLookup(this.store);
    const gridManager = this.gridManager;
    return `
      ${LayoutViewModel.pageHeader({ title: "Substations", subtitle: "Power substations under this guild." })}
      ${ResourceView.render(list, {
        success: (rows) => {
          const filterSchema = substationsFilterSchema(gridManager);
          const filters = parseFiltersFromParams(this.params, "", filterSchema);
          const t = new DataTable({
            id: "substations-table",
            filterSchema,
            filters,
            searchColumns: [
              { id: "id", label: "Substation ID" },
              { id: "name", label: "Name" },
            ],
            columns: [
              {
                id: "id",
                label: "Substation ID",
                get: (r) => r.id,
                sort: (a, b) => String(a.id).localeCompare(String(b.id)),
                render: (v) => renderEntityLink(v, lookup),
              },
              { id: "name", label: "Name", get: (r) => r.name ?? "—", sort: (a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")) },
              {
                id: "capacity",
                label: "Capacity",
                get: (r) =>
                  formatGridAttributeOrDash("capacity", gridManager.getForObject(r.id).capacity ?? r.capacity),
                align: "end",
              },
              {
                id: "load",
                label: "Load",
                get: (r) => formatGridAttributeOrDash("load", gridManager.getForObject(r.id).load ?? r.load),
                align: "end",
              },
              { id: "players", label: "Players", get: (r) => r.player_count ?? 0, sort: (a, b) => (a.player_count ?? 0) - (b.player_count ?? 0), align: "end" },
            ],
            rows: Array.isArray(rows) ? rows : [],
            onRowClick: (r) => `/energy/substations/${r.id}`,
            ...parseTableParams(this.params),
          });
          return t.renderHTML();
        },
      })}
    `;
  }

  bind() {
    const filterSchema = substationsFilterSchema(this.gridManager);
    const params = this.params;
    bindDataTable(
      this.container?.querySelector("#substations-table"),
      {
        id: "substations-table",
        filterSchema,
        filters: parseFiltersFromParams(params, "", filterSchema),
        ...tableBindState(params),
      },
      {
        onChange: (next) => gotoTableState(this.router, "/energy/substations", params, next, filterSchema),
        onNavigate: (path) => this.router.goto(path),
      },
    );
  }
}

