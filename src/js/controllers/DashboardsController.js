import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { statCard } from "../view_models/components/StatCard.js";
import { keys } from "../store/keys.js";

export class DashboardsController extends AbstractController {
  constructor(deps) {
    super("Dashboards", deps.store);
    this.layout = deps.layout;
    this.statManager = deps.statManager;
  }

  activate() {
    const session = this.store.session?.data;
    if (!session) return;
    void this.statManager.fetchRange("power", session.guildId);
    void this.statManager.fetchRange("load", session.guildId);
    this.layout.mountContent(
      new DashboardsViewModel({ store: this.store, guildId: session.guildId }),
    );
  }
}

class DashboardsViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.guildId = deps.guildId;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.statRange("power", this.guildId));
    this.subscribe(this.store, keys.statRange("load", this.guildId));
  }

  render() {
    const power = this.store.read(keys.statRange("power", this.guildId));
    const load = this.store.read(keys.statRange("load", this.guildId));

    return `
      ${LayoutViewModel.pageHeader({ title: "Metrics", subtitle: "Guild power and load (24h)." })}
      <div class="row g-3">
        <div class="col-md-6">
          <div class="sg-card">
            <div class="sg-card__title">Power</div>
            ${renderStatSummary(power)}
          </div>
        </div>
        <div class="col-md-6">
          <div class="sg-card">
            <div class="sg-card__title">Load</div>
            ${renderStatSummary(load)}
          </div>
        </div>
      </div>
    `;
  }
}

/** @param {import("../store/Resource.js").Resource<unknown>} res */
function renderStatSummary(res) {
  return ResourceView.render(res, {
    success: (rows) => {
      const list = /** @type {import("../types/api.js").StatRowData[]} */ (Array.isArray(rows) ? rows : []);
      if (!list.length) {
        return `<div class="sg-empty"><div class="sg-empty__hint">No stat samples in range.</div></div>`;
      }
      const latest = list[list.length - 1];
      const earliest = list[0];
      return `
        <div class="sg-stat-grid">
          ${statCard({ label: "Latest", value: String(latest?.value ?? "—") })}
          ${statCard({ label: "Earliest", value: String(earliest?.value ?? "—") })}
          ${statCard({ label: "Samples", value: String(list.length) })}
        </div>
      `;
    },
  });
}
