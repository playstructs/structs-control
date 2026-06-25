import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { statCard } from "../view_models/components/StatCard.js";
import { floatingLabelField } from "../view_models/components/FloatingLabelField.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { idle, loading, success, error, missing } from "../store/Resource.js";
import { notify } from "../store/notify.js";
import { bindDataTable, tableBindState } from "../util/bindDataTable.js";
import { parseTableParams } from "../util/tableFilters.js";
import { rangeFilterField, statusFilterField } from "../util/tableFilterSchemas.js";
import { pfpAvatar, PfpViewer } from "../view_models/components/PfpViewer.js";

/**
 * /dev/components -- visual gallery of every reusable view-model component.
 * Behind STRUCTS_DEV_GALLERY=1; index.js conditionally registers the route.
 */
export class DevComponentsController extends AbstractController {
  constructor(deps) {
    super("DevComponents", deps.store);
    this.layout = deps.layout;
  }

  activate() {
    this.layout.mountContent(new DevComponentsViewModel());
  }
}

const DEV_FILTER_SCHEMA = [
  statusFilterField((r) => (r.guild_rank % 2 === 0 ? "online" : "offline")),
  rangeFilterField("rank", "Rank", (r) => r.guild_rank),
];

class DevComponentsViewModel extends AbstractViewModel {
  constructor() {
    super();
    /** @type {Record<string, unknown>} */
    this.tableParams = {};
    /** @type {Record<string, unknown>} */
    this.filteredTableParams = { f: "status:online", "rank.min": 1 };
    /** Stable random avatars for the gallery demo. */
    this.demoPfps = Array.from({ length: 5 }, () => new PfpViewer(null, true).pfp);
    /** Editable avatar for the regenerate demo. */
    this.editorPfp = new PfpViewer(null, true).pfp;
  }

  render() {
    const sampleRows = Array.from({ length: 7 }, (_, i) => ({
      id: `0-${i + 1}`,
      name: `Player ${i + 1}`,
      guild_rank: i % 5,
    }));

    const table = new DataTable({
      id: "dev-table",
      filterSchema: DEV_FILTER_SCHEMA,
      filters: { status: ["online"], rank: { min: 1 } },
      searchColumns: [
        { id: "id", label: "ID" },
        { id: "name", label: "Name" },
      ],
      columns: [
        { id: "id", label: "ID", get: (r) => r.id, sort: (a, b) => String(a.id).localeCompare(b.id) },
        { id: "name", label: "Name", get: (r) => r.name, sort: (a, b) => a.name.localeCompare(b.name) },
        { id: "rank", label: "Rank", get: (r) => r.guild_rank, align: "end" },
      ],
      rows: sampleRows,
      ...parseTableParams(this.tableParams),
    });

    const filteredTable = new DataTable({
      id: "dev-table-filtered",
      filterSchema: DEV_FILTER_SCHEMA,
      filters: { status: ["online"], rank: { min: 1, max: 3 } },
      searchColumns: [
        { id: "id", label: "ID" },
        { id: "name", label: "Name" },
      ],
      columns: [
        { id: "id", label: "ID", get: (r) => r.id, sort: (a, b) => String(a.id).localeCompare(b.id) },
        { id: "name", label: "Name", get: (r) => r.name, sort: (a, b) => a.name.localeCompare(b.name) },
        { id: "rank", label: "Rank", get: (r) => r.guild_rank, align: "end" },
      ],
      rows: sampleRows,
      q: "player",
      field: "name",
      page: 1,
    });

    return `
      ${LayoutViewModel.pageHeader({ title: "Components gallery", subtitle: "Visual reference for every reusable view." })}
      <div class="row g-4">
        <div class="col-md-12">
          <h6 class="text-secondary text-uppercase small">Stat cards</h6>
          <div class="sg-stat-grid">
            ${statCard({ label: "Members", value: "128", sub: "+4 today" })}
            ${statCard({ label: "Substations", value: "5" })}
            ${statCard({ label: "Energy", value: "92%", sub: "of capacity" })}
            ${statCard({ label: "Pending tx", value: "0" })}
          </div>
        </div>
        <div class="col-md-12">
          <h6 class="text-secondary text-uppercase small">ResourceView states</h6>
          <div class="row g-3">
            <div class="col-md-3"><div class="sg-card">${ResourceView.render(loading(), { success: () => "" })}</div></div>
            <div class="col-md-3"><div class="sg-card">${ResourceView.render(error(new Error("Boom")), { success: () => "" })}</div></div>
            <div class="col-md-3"><div class="sg-card">${ResourceView.render(missing(), { success: () => "" })}</div></div>
            <div class="col-md-3"><div class="sg-card">${ResourceView.render(success({ a: 1 }), { success: (d) => `<pre class="mb-0 small">${JSON.stringify(d, null, 2)}</pre>` })}</div></div>
          </div>
        </div>
        <div class="col-md-12">
          <h6 class="text-secondary text-uppercase small">DataTable (default)</h6>
          ${table.renderHTML()}
        </div>
        <div class="col-md-12">
          <h6 class="text-secondary text-uppercase small">DataTable (active filters + search)</h6>
          ${filteredTable.renderHTML()}
        </div>
        <div class="col-md-6">
          <h6 class="text-secondary text-uppercase small">Floating labels</h6>
          <div class="sg-card">
            ${floatingLabelField({ id: "dev-name", name: "name", label: "Name" })}
            <div class="mt-2">${floatingLabelField({ id: "dev-addr", name: "addr", label: "Address", value: "structs1abc..." })}</div>
          </div>
        </div>
        <div class="col-md-12">
          <h6 class="text-secondary text-uppercase small">Profile pictures</h6>
          <div class="sg-card d-flex flex-column gap-3">
            <div>
              <div class="text-secondary small mb-2">Placeholder &amp; sizes</div>
              <div class="d-flex align-items-end gap-3">
                ${pfpAvatar({ attributes: null, size: "lg" })}
                ${pfpAvatar({ attributes: this.editorPfp, size: "sm" })}
                ${pfpAvatar({ attributes: this.editorPfp, size: "md" })}
                ${pfpAvatar({ attributes: this.editorPfp, size: "lg" })}
              </div>
            </div>
            <div>
              <div class="text-secondary small mb-2">Random avatars</div>
              <div class="d-flex flex-wrap gap-2">
                ${this.demoPfps.map((p) => pfpAvatar({ attributes: p, size: "md" })).join("")}
              </div>
            </div>
            <div>
              <div class="text-secondary small mb-2">Editor (regenerate)</div>
              <div class="d-flex align-items-center gap-3">
                ${pfpAvatar({ attributes: this.editorPfp, size: "lg" })}
                <button class="btn btn-light btn-sm" data-action="pfp-regenerate"><i class="bi bi-shuffle me-1"></i>Regenerate</button>
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <h6 class="text-secondary text-uppercase small">Notifications</h6>
          <div class="sg-card d-flex flex-wrap gap-2">
            <button class="btn btn-primary btn-sm" data-action="toast-info">Toast info</button>
            <button class="btn btn-success btn-sm" data-action="toast-success">Toast success</button>
            <button class="btn btn-warning btn-sm" data-action="toast-warning">Toast warning</button>
            <button class="btn btn-danger btn-sm" data-action="toast-danger">Toast danger</button>
            <button class="btn btn-light btn-sm" data-action="banner">Banner</button>
          </div>
        </div>
        ${idle().status === "idle" ? "" : ""}
      </div>
    `;
  }

  bind() {
    if (!this.container) return;
    this.container
      .querySelector('[data-action="toast-info"]')
      ?.addEventListener("click", () => notify.toast("Info", "info"));
    this.container
      .querySelector('[data-action="toast-success"]')
      ?.addEventListener("click", () => notify.toast("Success", "success"));
    this.container
      .querySelector('[data-action="toast-warning"]')
      ?.addEventListener("click", () => notify.toast("Warning", "warning"));
    this.container
      .querySelector('[data-action="toast-danger"]')
      ?.addEventListener("click", () => notify.toast("Danger", "danger"));
    this.container
      .querySelector('[data-action="banner"]')
      ?.addEventListener("click", () => notify.banner("This is a banner.", "warning"));
    this.container.querySelector('[data-action="pfp-regenerate"]')?.addEventListener("click", () => {
      this.editorPfp = new PfpViewer(null, true).pfp;
      this.update();
    });

    const bindLocal = (selector, paramsKey) => {
      const root = this.container?.querySelector(selector);
      if (!root) return;
      const params = paramsKey === "table" ? this.tableParams : this.filteredTableParams;
      bindDataTable(
        root,
        {
          id: selector.slice(1),
          filterSchema: DEV_FILTER_SCHEMA,
          filters: paramsKey === "table" ? {} : { status: ["online"], rank: { min: 1, max: 3 } },
          ...tableBindState(params),
        },
        {
          onChange: (next) => {
            if (paramsKey === "table") {
              this.tableParams = { ...this.tableParams, ...next };
              if (!this.tableParams.q) delete this.tableParams.q;
              if (!this.tableParams.sort) delete this.tableParams.sort;
              if (!this.tableParams.field) delete this.tableParams.field;
              if (this.tableParams.page === 1) delete this.tableParams.page;
            }
            this.update();
          },
        },
      );
    };

    bindLocal("#dev-table", "table");
    bindLocal("#dev-table-filtered", "filtered");
  }
}
