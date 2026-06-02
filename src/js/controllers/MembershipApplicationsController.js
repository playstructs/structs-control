import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { notify } from "../store/notify.js";
import { keys } from "../store/keys.js";
import { statusBadge } from "../util/statusDisplay.js";
import { bindDataTable } from "../util/bindDataTable.js";

export class MembershipApplicationsController extends AbstractController {
  constructor(deps) {
    super("MembershipApplications", deps.store);
    this.layout = deps.layout;
    this.membershipManager = deps.membershipManager;
  }

  activate() {
    const session = this.store.session?.data;
    if (!session) return;
    void this.membershipManager.fetchByGuild(session.guildId);
    this.layout.mountContent(
      new MembershipApplicationsViewModel({
        store: this.store,
        guildId: session.guildId,
        membershipManager: this.membershipManager,
      }),
    );
  }
}

class MembershipApplicationsViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.guildId = deps.guildId;
    this.membershipManager = deps.membershipManager;
    /** @type {{ q?: string, sort?: string, page?: number }} */
    this.tableParams = {};
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.membershipApplications(this.guildId));
  }

  render() {
    const apps = this.store.read(keys.membershipApplications(this.guildId));
    return `
      ${LayoutViewModel.pageHeader({ title: "Applications", subtitle: "Pending membership requests and invites." })}
      ${ResourceView.render(apps, {
        success: (rows) => {
          const list = /** @type {import("../types/api.js").MembershipApplicationData[]} */ (
            Array.isArray(rows) ? rows : []
          );
          const table = new DataTable({
            id: "applications-table",
            searchScope: "Applications",
            columns: [
              {
                id: "player",
                label: "Player",
                get: (a) => a.player_id ?? a.playerId ?? "—",
                render: (v) => `<span class="sg-datatable__cell-mono">${escapeHtml(v)}</span>`,
              },
              { id: "type", label: "Type", get: (a) => a.join_type ?? a.joinType ?? "—" },
              {
                id: "substation",
                label: "Substation",
                get: (a) => a.substation_id ?? a.substationId ?? "—",
                render: (v) => `<span class="sg-datatable__cell-mono">${escapeHtml(v)}</span>`,
              },
              {
                id: "status",
                label: "Status",
                get: (a) => a.status ?? a.registration_status ?? a.registrationStatus ?? "—",
                render: (v) => statusBadge(String(v)),
              },
              {
                id: "actions",
                label: "",
                align: "end",
                get: () => "",
                render: (_v, a) => {
                  const playerId = a.player_id ?? a.playerId ?? "";
                  return `<div class="d-flex justify-content-end gap-1">
                    <button type="button" class="btn btn-sm btn-success" data-action="approve" data-player-id="${escapeAttr(playerId)}">Approve</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-action="deny" data-player-id="${escapeAttr(playerId)}">Deny</button>
                  </div>`;
                },
              },
            ],
            rows: list,
            keyFn: (a) => String(a.player_id ?? a.playerId ?? ""),
            emptyMessage: "No pending applications.",
            pageSize: 25,
            q: this.tableParams.q,
            sort: this.tableParams.sort,
            page: Number(this.tableParams.page) || 1,
          });
          return table.renderHTML();
        },
      })}
    `;
  }

  bind() {
    if (!this.container) return;
    const root = this.container.querySelector("#applications-table");
    if (!root) return;

    root.querySelectorAll('[data-action="approve"], [data-action="deny"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const playerId = /** @type {HTMLElement} */ (btn).dataset.playerId;
        const approve = btn.getAttribute("data-action") === "approve";
        if (!playerId) return;
        const apps = this.store.read(keys.membershipApplications(this.guildId));
        const list = /** @type {import("../types/api.js").MembershipApplicationData[]} */ (
          Array.isArray(apps.data) ? apps.data : []
        );
        const app = list.find((a) => String(a.player_id ?? a.playerId) === playerId);
        if (!app) return;
        const msg = this.membershipManager.buildActionMessage(app, approve);
        void this.store.tx?.enqueue(msg, {
          invalidate: [keys.membershipApplications(this.guildId), keys.guildRoster(this.guildId)],
        });
        notify.toast(approve ? "Approve enqueued" : "Deny enqueued", "info");
      });
    });

    bindDataTable(root, this.tableParams, {
      onChange: (next) => {
        this.tableParams = { ...this.tableParams, ...next };
        if (!this.tableParams.q) delete this.tableParams.q;
        if (!this.tableParams.sort) delete this.tableParams.sort;
        if (this.tableParams.page === 1) delete this.tableParams.page;
        this.update();
      },
    });
  }
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
