import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { keys } from "../store/keys.js";
import { bindDataTable, gotoTableState } from "../util/bindDataTable.js";

export class SubstationsController extends AbstractController {
  constructor(deps) {
    super("Substations", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.substationManager = deps.substationManager;
  }

  activate(_page, params) {
    void this.substationManager.fetchList();
    this.layout.mountContent(
      new SubstationsListViewModel({ store: this.store, router: this.router, params: params ?? {} }),
    );
  }
}

class SubstationsListViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.params = deps.params;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.substationList());
  }

  render() {
    const list = this.store.read(keys.substationList());
    return `
      ${LayoutViewModel.pageHeader({ title: "Substations", subtitle: "Power substations under this guild." })}
      ${ResourceView.render(list, {
        success: (rows) => {
          const t = new DataTable({
            id: "substations-table",
            searchScope: "Substations",
            columns: [
              {
                id: "id",
                label: "Substation ID",
                get: (r) => r.id,
                sort: (a, b) => String(a.id).localeCompare(String(b.id)),
                render: (v) => `<span class="sg-datatable__cell-mono">${escapeHtml(v)}</span>`,
              },
              { id: "name", label: "Name", get: (r) => r.name ?? "—", sort: (a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")) },
              { id: "capacity", label: "Capacity", get: (r) => r.capacity ?? "—", align: "end" },
              { id: "load", label: "Load", get: (r) => r.load ?? "—", align: "end" },
              { id: "players", label: "Players", get: (r) => r.player_count ?? 0, sort: (a, b) => (a.player_count ?? 0) - (b.player_count ?? 0), align: "end" },
            ],
            rows: Array.isArray(rows) ? rows : [],
            onRowClick: (r) => `/energy/substations/${r.id}`,
            sort: this.params.sort,
            q: this.params.q,
            page: Number(this.params.page) || 1,
          });
          return t.renderHTML();
        },
      })}
    `;
  }

  bind() {
    bindDataTable(this.container?.querySelector("#substations-table"), this.params, {
      onChange: (next) => gotoTableState(this.router, "/energy/substations", this.params, next),
      onNavigate: (path) => this.router.goto(path),
    });
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
