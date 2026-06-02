import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { notify } from "../store/notify.js";
import { keys } from "../store/keys.js";
import {
  allocationControllerId,
  allocationDestinationId,
  allocationId,
  allocationSourceId,
  allocationTypeLabel,
} from "../util/allocationDisplay.js";
import { bindDataTable, gotoTableState } from "../util/bindDataTable.js";

export class EnergyGridController extends AbstractController {
  constructor(deps) {
    super("EnergyGrid", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.allocationManager = deps.allocationManager;
  }

  activate(_page, params) {
    void this.allocationManager.fetchList();
    this.layout.mountContent(
      new EnergyGridViewModel({
        store: this.store,
        router: this.router,
        allocationManager: this.allocationManager,
        params: params ?? {},
      }),
    );
  }
}

class EnergyGridViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.allocationManager = deps.allocationManager;
    this.params = deps.params;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.allocationList());
  }

  render() {
    const list = this.store.read(keys.allocationList());
    return `
      ${LayoutViewModel.pageHeader({ title: "Energy grid", subtitle: "All power allocations on the guild chain." })}
      ${ResourceView.render(list, {
        success: (rows) => {
          const t = new DataTable({
            id: "alloc-table",
            searchScope: "Allocations",
            columns: [
              {
                id: "id",
                label: "ID",
                get: allocationId,
                sort: (a, b) => allocationId(a).localeCompare(allocationId(b)),
                render: (v) => `<span class="sg-datatable__cell-mono">${escapeHtml(v)}</span>`,
              },
              { id: "type", label: "Type", get: allocationTypeLabel },
              {
                id: "source",
                label: "Source",
                get: allocationSourceId,
                render: (v) => `<span class="sg-datatable__cell-mono">${escapeHtml(v)}</span>`,
              },
              {
                id: "destination",
                label: "Destination",
                get: allocationDestinationId,
                render: (v) => `<span class="sg-datatable__cell-mono">${escapeHtml(v)}</span>`,
              },
              {
                id: "controller",
                label: "Controller",
                get: allocationControllerId,
                render: (v) => `<span class="sg-datatable__cell-mono">${escapeHtml(v)}</span>`,
              },
              {
                id: "actions",
                label: "",
                align: "end",
                get: () => "",
                render: (_v, row) => {
                  const id = allocationId(row);
                  return `<div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-light" data-action="update-alloc" data-id="${escapeAttr(id)}" data-source="${escapeAttr(allocationSourceId(row))}">Update</button>
                    <button type="button" class="btn btn-outline-danger" data-action="delete-alloc" data-id="${escapeAttr(id)}" data-source="${escapeAttr(allocationSourceId(row))}">Delete</button>
                  </div>`;
                },
              },
            ],
            rows: Array.isArray(rows) ? rows : [],
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
    const root = this.container?.querySelector("#alloc-table");
    if (!root) return;
    const params = this.params;
    bindDataTable(root, params, {
      onChange: (next) => gotoTableState(this.router, "/energy/grid", params, next),
    });

    root.querySelectorAll('[data-action="delete-alloc"]').forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = /** @type {HTMLElement} */ (btn).dataset.id;
        const sourceId = /** @type {HTMLElement} */ (btn).dataset.source;
        if (!id || !window.confirm(`Delete allocation ${id}?`)) return;
        void this.allocationManager.enqueueDelete({ allocationId: id, sourceId: sourceId !== "—" ? sourceId : undefined });
        notify.toast("Delete enqueued", "info");
      }),
    );

    root.querySelectorAll('[data-action="update-alloc"]').forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = /** @type {HTMLElement} */ (btn).dataset.id;
        const sourceId = /** @type {HTMLElement} */ (btn).dataset.source;
        if (!id) return;
        const power = window.prompt("New power value (whole number):");
        if (power == null || !/^\d+$/.test(power)) return;
        void this.allocationManager.enqueueUpdate({
          allocationId: id,
          power,
          sourceId: sourceId !== "—" ? sourceId : undefined,
        });
        notify.toast("Update enqueued", "info");
      }),
    );
  }
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
