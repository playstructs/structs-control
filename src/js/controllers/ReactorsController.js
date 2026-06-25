import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { tableSectionCard } from "../view_models/components/TableSectionCard.js";
import { keys } from "../store/keys.js";
import { bindDataTable, gotoTableState, tableBindState } from "../util/bindDataTable.js";
import { parseFiltersFromParams, parseTableParams } from "../util/tableFilters.js";
import { milliwattRangeField, statusFilterField } from "../util/tableFilterSchemas.js";
import { formatGridAttributeOrDash } from "../util/unitDisplay.js";
import { buildEntityLookup } from "../util/entityLookup.js";
import { renderEntityLink, renderEntityRef } from "../util/entityLink.js";

/**
 * Reactor endpoints are optional -- ResourceView's "missing" state renders an
 * empty card when the API doesn't expose them.
 */
export class ReactorsController extends AbstractController {
  constructor(deps) {
    super("Reactors", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.reactorManager = deps.reactorManager;
    this.gridManager = deps.gridManager;
  }

  activate(_page, params) {
    const session = this.store.session?.data;
    if (!session) return;
    void this.reactorManager.fetchList(session.guildId);
    void this.reactorManager.fetchNetwork();
    this.layout.mountContent(
      new ReactorsViewModel({
        store: this.store,
        router: this.router,
        guildId: session.guildId,
        gridManager: this.gridManager,
        params: params ?? {},
      }),
    );
  }
}

const YOUR_PREFIX = "y.";
const NETWORK_PREFIX = "n.";

/** @param {import("../managers/GridManager.js").GridManager} gridManager */
function reactorFilterSchema(gridManager) {
  return [
    statusFilterField((r) => r.status ?? (r.active === false ? "offline" : "online")),
    milliwattRangeField("capacity", "Total Energy Produced (KW)", (r) => {
      const grid = gridManager.getForObject(r.id);
      return grid.capacity ?? r.capacity;
    }),
    milliwattRangeField("load", "Amount (KW)", (r) => {
      const grid = gridManager.getForObject(r.id);
      return grid.load ?? r.load;
    }),
  ];
}

class ReactorsViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.guildId = deps.guildId;
    this.gridManager = deps.gridManager;
    this.params = deps.params;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.reactorList(this.guildId));
    this.subscribe(this.store, keys.reactorNetwork());
    this.subscribe(this.store, keys.gridIndex());
  }

  render() {
    const yours = this.store.read(keys.reactorList(this.guildId));
    const network = this.store.read(keys.reactorNetwork());
    const lookup = buildEntityLookup(this.store);
    const filterSchema = reactorFilterSchema(this.gridManager);

    return `
      <div class="d-flex flex-column gap-3">
        ${ResourceView.render(yours, {
          success: (rows) =>
            tableSectionCard({
              title: "Your Reactors",
              subtitle: "Reactors in your guild.",
              bodyHtml: renderReactorTable({
                id: "your-reactors-table",
                rows,
                lookup,
                gridManager: this.gridManager,
                params: this.params,
                prefix: YOUR_PREFIX,
                filterSchema,
                onRowClick: (r) => `/energy/reactors/${r.id}`,
              }),
            }),
        })}
        ${ResourceView.render(network, {
          success: (rows) =>
            tableSectionCard({
              title: "Network Reactors",
              subtitle: "Reactors in the network.",
              bodyHtml: renderReactorTable({
                id: "network-reactors-table",
                rows,
                lookup,
                gridManager: this.gridManager,
                params: this.params,
                prefix: NETWORK_PREFIX,
                filterSchema,
                onRowClick: (r) => `/energy/reactors/${r.id}`,
              }),
            }),
        })}
      </div>
    `;
  }

  bind() {
    this._bindTable("#your-reactors-table", YOUR_PREFIX, reactorFilterSchema(this.gridManager));
    this._bindTable("#network-reactors-table", NETWORK_PREFIX, reactorFilterSchema(this.gridManager));
  }

  /** @param {string} selector @param {string} prefix @param {import("../util/tableFilters.js").FilterField[]} filterSchema */
  _bindTable(selector, prefix, filterSchema) {
    const root = this.container?.querySelector(selector);
    if (!root) return;
    bindDataTable(
      root,
      {
        id: selector.slice(1),
        paramPrefix: prefix,
        filterSchema,
        filters: parseFiltersFromParams(this.params, prefix, filterSchema),
        ...tableBindState(this.params, prefix),
      },
      {
        onChange: (next) => gotoTableState(this.router, "/energy/reactors", this.params, next, filterSchema, prefix),
        onNavigate: (path) => this.router.goto(path),
      },
    );
  }
}

/**
 * @param {{
 *   id: string,
 *   rows: unknown,
 *   lookup: import("../util/entityLookup.js").EntityLookup,
 *   gridManager: import("../managers/GridManager.js").GridManager,
 *   params: Record<string, string>,
 *   prefix: string,
 *   filterSchema: import("../util/tableFilters.js").FilterField[],
 *   onRowClick?: (row: any) => string,
 * }} opts
 */
function renderReactorTable(opts) {
  const list = Array.isArray(opts.rows) ? opts.rows : [];
  const filters = parseFiltersFromParams(opts.params, opts.prefix, opts.filterSchema);
  const tableParams = parseTableParams(opts.params, opts.prefix);

  const t = new DataTable({
    id: opts.id,
    paramPrefix: opts.prefix,
    embedded: true,
    filterSchema: opts.filterSchema,
    filters,
    columns: [
      {
        id: "id",
        label: "Reactor Name",
        get: (r) => r.id,
        sort: (a, b) => String(a.id).localeCompare(String(b.id)),
        render: (v) => renderEntityLink(v, opts.lookup),
      },
      {
        id: "owner",
        label: "Owner",
        get: (r) => r.owner_id ?? r.owner ?? "—",
        render: (v) => renderEntityRef(v, opts.lookup),
      },
      {
        id: "capacity",
        label: "Capacity",
        get: (r) => formatGridAttributeOrDash("capacity", opts.gridManager.getForObject(r.id).capacity ?? r.capacity),
        align: "end",
      },
      {
        id: "load",
        label: "Load",
        get: (r) => formatGridAttributeOrDash("load", opts.gridManager.getForObject(r.id).load ?? r.load),
        align: "end",
      },
    ],
    searchColumns: [
      { id: "id", label: "Reactor Name" },
      { id: "owner", label: "Owner" },
    ],
    rows: list,
    onRowClick: opts.onRowClick,
    ...tableParams,
    emptyMessage: "No reactors.",
  });
  return t.renderHTML();
}
