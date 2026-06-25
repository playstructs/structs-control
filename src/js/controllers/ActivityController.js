import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { statusBadge } from "../util/statusDisplay.js";
import { TX_STATUS } from "../constants/SigningQueueConstants.js";
import { notify } from "../store/notify.js";

/**
 * Activity / Alerts page.
 *
 * Two views over `store.tx`:
 *   - Queue:   pending + in-flight txs, in broadcast order, with operator
 *              controls (move up/down, cancel) and live ETA.
 *   - History: settled txs (confirmed / failed / cancelled), with retry for
 *              failures and an inspector for hash / error / payload.
 *
 * Re-renders on every tx state change via `store.tx.subscribe`.
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
    const tx = this.store.tx;
    const records = tx?.list() ?? [];

    const inFlight = records.filter((r) => r.status === TX_STATUS.SIGNING || r.status === TX_STATUS.CONFIRMING);
    const pending = records.filter((r) => r.status === TX_STATUS.PENDING);
    const history = records
      .filter(
        (r) => r.status === TX_STATUS.CONFIRMED || r.status === TX_STATUS.FAILED || r.status === TX_STATUS.CANCELLED,
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const queueRows = [...inFlight, ...pending];

    return `
      ${LayoutViewModel.pageHeader({
        title: "Activity",
        subtitle: "Transaction queue and history for this session.",
        actionsHtml: `<a class="btn btn-light btn-sm" href="/overview" data-spa-link><i class="bi bi-chevron-left me-1"></i>Back to Overview</a>`,
      })}

      <section class="sg-tx-section">
        <h2 class="sg-tx-section__title">Queue <span class="sg-tx-section__count">${queueRows.length}</span></h2>
        ${this._queueTable(queueRows, pending).renderHTML()}
      </section>

      <section class="sg-tx-section mt-4">
        <h2 class="sg-tx-section__title">History</h2>
        ${this._historyTable(history).renderHTML()}
      </section>
    `;
  }

  /**
   * @param {import("../store/TxQueue.js").TxRecord[]} rows
   * @param {import("../store/TxQueue.js").TxRecord[]} pending
   */
  _queueTable(rows, pending) {
    const tx = this.store.tx;
    return new DataTable({
      id: "tx-queue-table",
      hideToolbar: true,
      hideFooter: true,
      emptyMessage: "Queue is empty.",
      showEmptyIllustration: false,
      rows,
      keyFn: (r) => r.id,
      columns: [
        {
          id: "pos",
          label: "#",
          get: (r) => r,
          render: (_v, r) => {
            if (r.status !== TX_STATUS.PENDING) {
              return `<span class="sg-datatable__cell-mono"><i class="bi bi-arrow-repeat sg-tx-spin"></i></span>`;
            }
            const pos = pending.findIndex((p) => p.id === r.id) + 1;
            return `<span class="sg-datatable__cell-mono">${pos}</span>`;
          },
        },
        { id: "type", label: "Type", get: (r) => r.typeUrl.replace(/^.*\./, "") },
        { id: "status", label: "Status", get: (r) => r.status, render: (v) => statusBadge(String(v)) },
        { id: "attempts", label: "Attempts", align: "center", get: (r) => r.attempts },
        {
          id: "eta",
          label: "ETA",
          get: (r) => r,
          render: (_v, r) => {
            if (r.status === TX_STATUS.SIGNING) return "Broadcasting…";
            if (r.status === TX_STATUS.CONFIRMING) return "Confirming…";
            const wait = tx?.estimateWait(r.id);
            return wait ? formatEta(wait.etaMs) : "—";
          },
        },
        {
          id: "actions",
          label: "",
          align: "end",
          searchable: false,
          get: (r) => r,
          render: (_v, r) => {
            if (r.status !== TX_STATUS.PENDING) return "";
            const idx = pending.findIndex((p) => p.id === r.id);
            const isFirst = idx <= 0;
            const isLast = idx === pending.length - 1;
            return `
              <div class="sg-tx-actions">
                <button type="button" class="btn btn-sm btn-light" data-tx-action="up" data-tx-id="${escapeAttr(r.id)}" ${isFirst ? "disabled" : ""} title="Move up" aria-label="Move up"><i class="bi bi-arrow-up"></i></button>
                <button type="button" class="btn btn-sm btn-light" data-tx-action="down" data-tx-id="${escapeAttr(r.id)}" ${isLast ? "disabled" : ""} title="Move down" aria-label="Move down"><i class="bi bi-arrow-down"></i></button>
                <button type="button" class="btn btn-sm btn-outline-danger" data-tx-action="cancel" data-tx-id="${escapeAttr(r.id)}" title="Cancel"><i class="bi bi-x-lg me-1"></i>Cancel</button>
              </div>`;
          },
        },
      ],
    });
  }

  /**
   * @param {import("../store/TxQueue.js").TxRecord[]} rows
   */
  _historyTable(rows) {
    return new DataTable({
      id: "tx-history-table",
      hideToolbar: true,
      emptyMessage: "No settled transactions yet.",
      showEmptyIllustration: false,
      pageSize: 25,
      rows,
      keyFn: (r) => r.id,
      columns: [
        { id: "type", label: "Type", get: (r) => r.typeUrl.replace(/^.*\./, "") },
        { id: "status", label: "Status", get: (r) => r.status, render: (v) => statusBadge(String(v)) },
        {
          id: "hash",
          label: "Hash",
          get: (r) => (r.hash ? `${r.hash.slice(0, 12)}…` : "—"),
          render: (v) => `<span class="sg-datatable__cell-mono">${escapeHtml(v)}</span>`,
        },
        {
          id: "details",
          label: "Details",
          searchable: false,
          get: (r) => r,
          render: (_v, r) => renderDetails(r),
        },
        { id: "updated", label: "Updated", align: "end", get: (r) => new Date(r.updatedAt).toLocaleTimeString() },
        {
          id: "actions",
          label: "",
          align: "end",
          searchable: false,
          get: (r) => r,
          render: (_v, r) => {
            if (r.status !== TX_STATUS.FAILED) return "";
            return `<button type="button" class="btn btn-sm btn-light" data-tx-action="retry" data-tx-id="${escapeAttr(r.id)}" title="Retry"><i class="bi bi-arrow-clockwise me-1"></i>Retry</button>`;
          },
        },
      ],
    });
  }

  bind() {
    if (!this.container) return;
    const tx = this.store.tx;
    if (!tx) return;
    this.container.querySelectorAll("[data-tx-action]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const btn = /** @type {HTMLElement} */ (e.currentTarget);
        const id = btn.getAttribute("data-tx-id") ?? "";
        const action = btn.getAttribute("data-tx-action");
        let ok = false;
        if (action === "up") ok = tx.moveUp(id);
        else if (action === "down") ok = tx.moveDown(id);
        else if (action === "cancel") ok = tx.cancel(id);
        else if (action === "retry") ok = tx.retry(id);
        if (action === "cancel" && ok) notify.toast("Transaction cancelled", "info");
        if (action === "retry" && ok) notify.toast("Transaction re-queued", "info");
      });
    });
  }
}

/**
 * @param {import("../store/TxQueue.js").TxRecord} r
 */
function renderDetails(r) {
  const info = {
    id: r.id,
    typeUrl: r.typeUrl,
    hash: r.hash ?? null,
    height: r.height ?? null,
    attempts: r.attempts,
    error: r.error ?? null,
    payload: r.msg?.value ?? null,
  };
  let json = "";
  try {
    json = JSON.stringify(info, null, 2);
  } catch {
    json = String(info);
  }
  return `
    <details class="sg-tx-details">
      <summary>View</summary>
      <pre class="sg-tx-details__pre">${escapeHtml(json)}</pre>
    </details>`;
}

/** @param {number | undefined} ms */
function formatEta(ms) {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `~${s}s`;
  const m = Math.round(s / 60);
  return `~${m}m`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}
