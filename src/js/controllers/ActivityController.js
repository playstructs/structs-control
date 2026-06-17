import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { statusBadge } from "../util/statusDisplay.js";

/**
 * Activity / Alerts page. Reads tx records from store.tx and re-renders on
 * every tx state change.
 */
export class ActivityController extends AbstractController {
  constructor(deps) {
    super("Activity", deps.store);
    this.layout = deps.layout;
  }

  activate() {
    this.layout.mountContent(new ActivityViewModel({ store: this.store }));
  }
}

class ActivityViewModel extends AbstractViewModel {
  /**
   * @param {{ store: import("../store/Store.js").Store }} deps
   */
  constructor(deps) {
    super();
    this.store = deps.store;
    if (this.store.tx) {
      this._unsubs.push(this.store.tx.subscribe(() => this.update()));
    }
  }

  render() {
    const records = this.store.tx?.list() ?? [];
    const table = new DataTable({
      id: "activity-table",
      hideToolbar: true,
      columns: [
        { id: "id", label: "ID", get: (r) => r.id, render: (v) => `<span class="sg-datatable__cell-mono">${escapeHtml(v)}</span>` },
        { id: "type", label: "Type", get: (r) => r.typeUrl.replace(/^.*\./, "") },
        {
          id: "status",
          label: "Status",
          get: (r) => r.status,
          render: (v) => statusBadge(String(v)),
        },
        {
          id: "hash",
          label: "Hash",
          get: (r) => (r.hash ? `${r.hash.slice(0, 12)}…` : "—"),
          render: (v) => `<span class="sg-datatable__cell-mono">${escapeHtml(v)}</span>`,
        },
        {
          id: "updated",
          label: "Updated",
          align: "end",
          get: (r) => new Date(r.updatedAt).toLocaleTimeString(),
        },
      ],
      rows: records,
      emptyMessage: "No transactions yet.",
      pageSize: 50,
    });

    return `
      ${LayoutViewModel.pageHeader({
        title: "Activity",
        subtitle: "Transactions submitted this session.",
        actionsHtml: `<a class="btn btn-light btn-sm" href="/overview" data-spa-link><i class="bi bi-chevron-left me-1"></i>Back to Overview</a>`,
      })}
      ${table.renderHTML()}
    `;
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
