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
  formatAllocationPower,
} from "../util/allocationDisplay.js";
import { bindDataTable, gotoTableState } from "../util/bindDataTable.js";
import { buildEntityLookup } from "../util/entityLookup.js";
import { renderEntityRef } from "../util/entityLink.js";

export class AllocationsController extends AbstractController {
  constructor(deps) {
    super("Allocations", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.allocationManager = deps.allocationManager;
    this.gridManager = deps.gridManager;
  }

  activate(_page, params) {
    void this.allocationManager.fetchList();
    this.layout.mountContent(
      new AllocationsViewModel({
        store: this.store,
        router: this.router,
        allocationManager: this.allocationManager,
        gridManager: this.gridManager,
        params: params ?? {},
      }),
    );
  }
}

class AllocationsViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.allocationManager = deps.allocationManager;
    this.gridManager = deps.gridManager;
    this.params = deps.params;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.allocationList());
    this.subscribe(this.store, keys.gridIndex());
  }

  /** @returns {import("../util/gridIndex.js").GridIndex | null} */
  _gridIndex() {
    const res = this.store.read(keys.gridIndex());
    return res.status === "success" && res.data && typeof res.data === "object"
      ? /** @type {import("../util/gridIndex.js").GridIndex} */ (res.data)
      : null;
  }

  render() {
    const list = this.store.read(keys.allocationList());
    const gridIndex = this._gridIndex();
    const lookup = buildEntityLookup(this.store);

    return `
      ${LayoutViewModel.pageHeader({
        title: "Allocations",
        subtitle: "Power flow from sources to destinations on the guild chain.",
      })}
      ${ResourceView.render(list, {
        success: (rows) => {
          const t = new DataTable({
            id: "alloc-table",
            searchScope: "Allocations",
            columns: [
              {
                id: "type",
                label: "Type",
                get: allocationTypeLabel,
                sort: (a, b) => allocationTypeLabel(a).localeCompare(allocationTypeLabel(b)),
              },
              {
                id: "destination",
                label: "Destination",
                get: allocationDestinationId,
                sort: (a, b) => allocationDestinationId(a).localeCompare(allocationDestinationId(b)),
                render: (v) => renderEntityRef(v, lookup),
              },
              {
                id: "source",
                label: "Power source",
                get: allocationSourceId,
                sort: (a, b) => allocationSourceId(a).localeCompare(allocationSourceId(b)),
                render: (v) => renderEntityRef(v, lookup),
              },
              {
                id: "power",
                label: "Amount",
                align: "end",
                get: (row) => formatAllocationPower(row, gridIndex),
                sort: (a, b) =>
                  Number(formatAllocationPower(a, gridIndex).replace(/\D/g, "") || 0) -
                  Number(formatAllocationPower(b, gridIndex).replace(/\D/g, "") || 0),
              },
              {
                id: "controller",
                label: "Controller",
                get: allocationControllerId,
                render: (v) => renderEntityRef(v, lookup),
              },
              {
                id: "id",
                label: "ID",
                get: allocationId,
                render: (v) => renderEntityRef(v, lookup),
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
      onChange: (next) => gotoTableState(this.router, "/energy/allocations", params, next),
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
