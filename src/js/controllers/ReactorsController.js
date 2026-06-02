import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { tableShell } from "../view_models/components/TableShell.js";
import { keys } from "../store/keys.js";

/**
 * Reactor endpoints are optional -- ResourceView's "missing" state renders an
 * empty card when the API doesn't expose them.
 */
export class ReactorsController extends AbstractController {
  constructor(deps) {
    super("Reactors", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.reactorManager = deps.reactorManager;
  }

  activate() {
    const session = this.store.session?.data;
    if (!session) return;
    void this.reactorManager.fetchList(session.guildId);
    void this.reactorManager.fetchNetwork();
    this.layout.mountContent(new ReactorsViewModel({ store: this.store, router: this.router, guildId: session.guildId }));
  }
}

class ReactorsViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.guildId = deps.guildId;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.reactorList(this.guildId));
    this.subscribe(this.store, keys.reactorNetwork());
  }

  render() {
    const yours = this.store.read(keys.reactorList(this.guildId));
    const network = this.store.read(keys.reactorNetwork());
    return `
      ${LayoutViewModel.pageHeader({ title: "Reactors", subtitle: "Your reactors and the network." })}
      <div class="row g-3">
        <div class="col-md-6">
          <div class="sg-card">
            <div class="sg-card__title">Your reactors</div>
            ${renderReactorList(yours, this.router)}
          </div>
        </div>
        <div class="col-md-6">
          <div class="sg-card">
            <div class="sg-card__title">Network reactors</div>
            ${renderReactorList(network, this.router)}
          </div>
        </div>
      </div>
    `;
  }
}

function renderReactorList(res, _router) {
  return ResourceView.render(res, {
    success: (rows) => {
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) return `<div class="sg-empty"><div class="sg-empty__hint">No reactors.</div></div>`;
      return tableShell({
        embedded: true,
        tableHtml: `<thead><tr><th>ID</th><th>Owner</th><th class="text-end">Capacity</th><th class="text-end">Load</th></tr></thead><tbody>${list
          .map(
            (r) =>
              `<tr>
                <td><a href="/energy/reactors/${escapeAttr(r.id)}" class="sg-datatable__cell-mono">${escapeHtml(r.id)}</a></td>
                <td class="sg-datatable__cell-mono">${escapeHtml(r.owner_id ?? "—")}</td>
                <td class="text-end">${escapeHtml(r.capacity ?? "—")}</td>
                <td class="text-end">${escapeHtml(r.load ?? "—")}</td>
              </tr>`,
          )
          .join("")}</tbody>`,
      });
    },
  });
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
