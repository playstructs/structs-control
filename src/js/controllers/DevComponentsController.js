import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { statCard } from "../view_models/components/StatCard.js";
import { floatingLabelField } from "../view_models/components/FloatingLabelField.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { idle, loading, success, error, missing } from "../store/Resource.js";
import { notify } from "../store/notify.js";

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

class DevComponentsViewModel extends AbstractViewModel {
  render() {
    const sampleRows = Array.from({ length: 7 }, (_, i) => ({ id: `0-${i + 1}`, name: `Player ${i + 1}`, guild_rank: i % 5 }));
    const table = new DataTable({
      id: "dev-table",
      searchScope: "Players",
      columns: [
        { id: "id", label: "ID", get: (r) => r.id, sort: (a, b) => String(a.id).localeCompare(b.id) },
        { id: "name", label: "Name", get: (r) => r.name, sort: (a, b) => a.name.localeCompare(b.name) },
        { id: "rank", label: "Rank", get: (r) => r.guild_rank, align: "end" },
      ],
      rows: sampleRows,
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
          <h6 class="text-secondary text-uppercase small">DataTable</h6>
          ${table.renderHTML()}
        </div>
        <div class="col-md-6">
          <h6 class="text-secondary text-uppercase small">Floating labels</h6>
          <div class="sg-card">
            ${floatingLabelField({ id: "dev-name", name: "name", label: "Name" })}
            <div class="mt-2">${floatingLabelField({ id: "dev-addr", name: "addr", label: "Address", value: "structs1abc..." })}</div>
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
    this.container.querySelector('[data-action="toast-info"]')?.addEventListener("click", () => notify.toast("Info", "info"));
    this.container.querySelector('[data-action="toast-success"]')?.addEventListener("click", () => notify.toast("Success", "success"));
    this.container.querySelector('[data-action="toast-warning"]')?.addEventListener("click", () => notify.toast("Warning", "warning"));
    this.container.querySelector('[data-action="toast-danger"]')?.addEventListener("click", () => notify.toast("Danger", "danger"));
    this.container.querySelector('[data-action="banner"]')?.addEventListener("click", () => notify.banner("This is a banner.", "warning"));
  }
}
