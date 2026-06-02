import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { tableShell } from "../view_models/components/TableShell.js";
import { keys } from "../store/keys.js";
import { statusBadge } from "../util/statusDisplay.js";

/**
 * Energy market agreements and providers visible to this guild.
 */
export class GuildRelationshipsController extends AbstractController {
  constructor(deps) {
    super("GuildRelationships", deps.store);
    this.layout = deps.layout;
    this.providerManager = deps.providerManager;
    this.agreementManager = deps.agreementManager;
  }

  activate() {
    const session = this.store.session?.data;
    if (!session) return;
    void this.providerManager.fetchList();
    void this.agreementManager.fetchByGuild(session.guildId);
    this.layout.mountContent(
      new GuildRelationshipsViewModel({ store: this.store, guildId: session.guildId }),
    );
  }
}

class GuildRelationshipsViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.guildId = deps.guildId;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.providerList());
    this.subscribe(this.store, keys.agreementList(this.guildId));
  }

  render() {
    const providers = this.store.read(keys.providerList());
    const agreements = this.store.read(keys.agreementList(this.guildId));

    return `
      ${LayoutViewModel.pageHeader({ title: "Energy agreements", subtitle: "Providers and agreements in the energy market." })}
      <div class="row g-3">
        <div class="col-md-6">
          <div class="sg-card">
            <div class="sg-card__title">Providers</div>
            ${ResourceView.render(providers, {
              success: (rows) => renderProviderTable(rows),
            })}
          </div>
        </div>
        <div class="col-md-6">
          <div class="sg-card">
            <div class="sg-card__title">Agreements</div>
            ${ResourceView.render(agreements, {
              success: (rows) => renderAgreementTable(rows),
            })}
          </div>
        </div>
      </div>
    `;
  }
}

/** @param {unknown} rows */
function renderProviderTable(rows) {
  const list = /** @type {import("../types/api.js").ProviderData[]} */ (Array.isArray(rows) ? rows : []);
  if (!list.length) return `<div class="sg-empty"><div class="sg-empty__hint">No providers.</div></div>`;
  return tableShell({
    embedded: true,
    tableHtml: `<thead><tr><th>ID</th><th>Owner</th><th class="text-end">Capacity</th></tr></thead><tbody>${list
      .map(
        (p) =>
          `<tr>
            <td class="sg-datatable__cell-mono">${escapeHtml(p.id ?? "—")}</td>
            <td class="sg-datatable__cell-mono">${escapeHtml(p.owner_id ?? "—")}</td>
            <td class="text-end">${escapeHtml(p.capacity ?? "—")}</td>
          </tr>`,
      )
      .join("")}</tbody>`,
  });
}

/** @param {unknown} rows */
function renderAgreementTable(rows) {
  const list = /** @type {import("../types/api.js").AgreementData[]} */ (Array.isArray(rows) ? rows : []);
  if (!list.length) return `<div class="sg-empty"><div class="sg-empty__hint">No agreements for this guild.</div></div>`;
  return tableShell({
    embedded: true,
    tableHtml: `<thead><tr><th>ID</th><th>Provider</th><th class="text-end">Capacity</th><th>Active</th></tr></thead><tbody>${list
      .map(
        (a) =>
          `<tr>
            <td class="sg-datatable__cell-mono">${escapeHtml(a.id ?? "—")}</td>
            <td class="sg-datatable__cell-mono">${escapeHtml(a.provider_id ?? "—")}</td>
            <td class="text-end">${escapeHtml(a.capacity ?? "—")}</td>
            <td>${statusBadge(a.active ? "Online" : "Offline")}</td>
          </tr>`,
      )
      .join("")}</tbody>`,
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
