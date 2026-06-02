import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { tableShell } from "../view_models/components/TableShell.js";
import { keys } from "../store/keys.js";
import { formatGridAttributeOrDash } from "../util/unitDisplay.js";
import { buildEntityLookup } from "../util/entityLookup.js";
import { renderEntityLink, renderEntityRef } from "../util/entityLink.js";

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
    this.gridManager = deps.gridManager;
  }

  activate() {
    const session = this.store.session?.data;
    if (!session) return;
    void this.reactorManager.fetchList(session.guildId);
    void this.reactorManager.fetchNetwork();
    this.layout.mountContent(
      new ReactorsViewModel({
        store: this.store,
        router: this.router,
        guildId: session.guildId,
        gridManager: this.gridManager,
      }),
    );
  }
}

class ReactorsViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.guildId = deps.guildId;
    this.gridManager = deps.gridManager;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.reactorList(this.guildId));
    this.subscribe(this.store, keys.reactorNetwork());
    this.subscribe(this.store, keys.gridIndex());
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
            ${renderReactorList(yours, this.router, this.gridManager, this.store)}
          </div>
        </div>
        <div class="col-md-6">
          <div class="sg-card">
            <div class="sg-card__title">Network reactors</div>
            ${renderReactorList(network, this.router, this.gridManager, this.store)}
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * @param {import("../managers/GridManager.js").GridManager} gridManager
 */
function renderReactorList(res, _router, gridManager, store) {
  const lookup = buildEntityLookup(store);
  return ResourceView.render(res, {
    success: (rows) => {
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) return `<div class="sg-empty"><div class="sg-empty__hint">No reactors.</div></div>`;
      return tableShell({
        embedded: true,
        tableHtml: `<thead><tr><th>ID</th><th>Owner</th><th class="text-end">Capacity</th><th class="text-end">Load</th></tr></thead><tbody>${list
          .map((r) => {
            const grid = gridManager.getForObject(r.id);
            const capacity = formatGridAttributeOrDash("capacity", grid.capacity ?? r.capacity);
            const load = formatGridAttributeOrDash("load", grid.load ?? r.load);
            const owner = r.owner_id ?? r.owner;
            return `<tr>
                <td>${renderEntityLink(r.id, lookup)}</td>
                <td>${renderEntityRef(owner, lookup)}</td>
                <td class="text-end">${escapeHtml(capacity)}</td>
                <td class="text-end">${escapeHtml(load)}</td>
              </tr>`;
          })
          .join("")}</tbody>`,
      });
    },
  });
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
