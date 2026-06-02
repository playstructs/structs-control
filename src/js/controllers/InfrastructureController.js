import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { keys } from "../store/keys.js";

/**
 * Settings -> Infrastructure. Shows the runtime config (Guild API URL, chain
 * WS, NATS WS) the SPA is currently using. Read-only; edits require
 * redeploying public/config.js (per the static-CDN hosting model).
 */
export class InfrastructureController extends AbstractController {
  constructor(deps) {
    super("Infrastructure", deps.store);
    this.layout = deps.layout;
  }

  activate() {
    this.layout.mountContent(new InfrastructureViewModel({ store: this.store }));
  }
}

class InfrastructureViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.guildThis());
  }

  render() {
    const cfg = this.store.config;
    const guild = this.store.read(keys.guildThis());
    const guildData = /** @type {{ client_websocket?: string, grass_nats_websocket?: string } | null} */ (guild.data);

    return `
      ${LayoutViewModel.pageHeader({ title: "Infrastructure", subtitle: "Runtime configuration this SPA is using." })}
      <div class="sg-card">
        <div class="sg-card__title">Runtime</div>
        <dl class="row mb-0">
          ${dl("Guild API base", cfg.guildApiUrl || "/api (dev proxy)")}
          ${dl("Chain WS (override)", cfg.chainWsUrl || "—")}
          ${dl("Chain WS (from /guild/this)", guildData?.client_websocket ?? "—")}
          ${dl("NATS WS (override)", cfg.natsWsUrl || "—")}
          ${dl("NATS WS (from /guild/this)", guildData?.grass_nats_websocket ?? "—")}
          ${dl("Default guild ID", cfg.defaultGuildId || "—")}
          ${dl("Dev gallery", cfg.devGallery === "1" ? "enabled" : "disabled")}
        </dl>
      </div>
      <div class="sg-empty mt-3">
        <div class="sg-empty__title">Editing these</div>
        <div class="sg-empty__hint">Update <code>public/config.js</code> at the deploy and reload. No rebuild required.</div>
      </div>
    `;
  }
}

function dl(label, value) {
  return `<dt class="col-sm-4 text-secondary fw-normal small text-uppercase">${escapeHtml(label)}</dt><dd class="col-sm-8 mb-2 font-monospace small">${escapeHtml(value)}</dd>`;
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
