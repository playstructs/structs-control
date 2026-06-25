import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { NotificationDialogue } from "../framework/NotificationDialogue.js";
import { notify } from "../store/notify.js";
import { keys } from "../store/keys.js";
import { bindDataTable, gotoTableState, tableBindState } from "../util/bindDataTable.js";
import { parseFiltersFromParams, parseTableParams } from "../util/tableFilters.js";
import { rangeFilterField } from "../util/tableFilterSchemas.js";
import { buildEntityLookup } from "../util/entityLookup.js";
import { renderEntityLink } from "../util/entityLink.js";
import { tableSectionCard } from "../view_models/components/TableSectionCard.js";
import { pfpAvatar } from "../view_models/components/PfpViewer.js";

const PLAYERS_FILTER_SCHEMA = [rangeFilterField("rank", "Rank", (r) => r.guild_rank ?? 0)];

export class PlayersController extends AbstractController {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   layout: import("../view_models/LayoutViewModel.js").LayoutViewModel,
   *   router: import("../framework/MenuPageRouter.js").MenuPageRouter,
   *   guildManager: import("../managers/GuildManager.js").GuildManager,
   *   playerManager: import("../managers/PlayerManager.js").PlayerManager,
   * }} deps
   */
  constructor(deps) {
    super("Players", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.guildManager = deps.guildManager;
    this.playerManager = deps.playerManager;
  }

  async activate(page, params) {
    const session = this.store.session?.data;
    if (!session) return;
    void this.guildManager.fetchRoster(session.guildId);

    if (page === "bulk") {
      this.layout.mountContent(
        new PlayersBulkViewModel({
          store: this.store,
          router: this.router,
          guildId: session.guildId,
          playerManager: this.playerManager,
        }),
      );
      return;
    }

    this.layout.mountContent(
      new PlayersListViewModel({
        store: this.store,
        router: this.router,
        guildId: session.guildId,
        params,
      }),
    );
  }
}

class PlayersListViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.guildId = deps.guildId;
    this.params = deps.params;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.guildRoster(this.guildId));
  }

  render() {
    const roster = this.store.read(keys.guildRoster(this.guildId));
    const lookup = buildEntityLookup(this.store);
    const params = this.params;

    const body = ResourceView.render(roster, {
      success: (rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const filters = parseFiltersFromParams(params, "", PLAYERS_FILTER_SCHEMA);
        const table = new DataTable({
          id: "players-table",
          embedded: true,
          filterSchema: PLAYERS_FILTER_SCHEMA,
          filters,
          searchColumns: [
            { id: "id", label: "Player" },
            { id: "name", label: "Name" },
            { id: "address", label: "Address" },
          ],
          toolbarActionsHtml: `<a class="sg-btn-lunar" href="/players/bulk" data-action="bulk"><i class="bi bi-people"></i> Bulk actions</a>`,
          columns: [
            {
              id: "id",
              label: "Player",
              get: (r) => r.id,
              sort: (a, b) => String(a.id).localeCompare(String(b.id)),
              render: (v, row) =>
                `<span class="d-inline-flex align-items-center gap-2">${pfpAvatar({
                  attributes: row?.pfp_client_render_attributes ?? null,
                  size: "sm",
                })}${renderEntityLink(v, lookup)}</span>`,
            },
            {
              id: "name",
              label: "Name",
              get: (r) => r.name ?? "—",
              sort: (a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")),
            },
            {
              id: "address",
              label: "Primary address",
              get: (r) => r.primary_address ?? "—",
              render: (v) => `<span class="sg-datatable__cell-mono">${escapeHtml(v)}</span>`,
            },
            {
              id: "rank",
              label: "Rank",
              get: (r) => r.guild_rank ?? 0,
              sort: (a, b) => (a.guild_rank ?? 0) - (b.guild_rank ?? 0),
              align: "end",
            },
          ],
          rows: list,
          keyFn: (r) => String(r.id),
          onRowClick: (r) => `/players/${r.id}`,
          ...parseTableParams(params),
          pageSize: 25,
          emptyMessage: "No players in this guild yet.",
        });
        return tableSectionCard({
          title: "Players",
          subtitle: "Members of this guild.",
          bodyHtml: table.renderHTML(),
        });
      },
    });

    return body;
  }

  bind() {
    if (!this.container) return;

    this.container.querySelector('[data-action="bulk"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.router.goto("/players/bulk");
    });

    const root = this.container.querySelector("#players-table");
    if (root) {
      const params = this.params ?? {};
      bindDataTable(
        root,
        {
          id: "players-table",
          filterSchema: PLAYERS_FILTER_SCHEMA,
          filters: parseFiltersFromParams(params, "", PLAYERS_FILTER_SCHEMA),
          ...tableBindState(params),
        },
        {
          onChange: (next) => gotoTableState(this.router, "/players", params, next, PLAYERS_FILTER_SCHEMA),
          onNavigate: (path) => this.router.goto(path),
        },
      );
    }
  }
}

class PlayersBulkViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.guildId = deps.guildId;
    this.playerManager = deps.playerManager;
    /** @type {Set<string>} */
    this.selected = new Set();
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.guildRoster(this.guildId));
  }

  render() {
    const roster = this.store.read(keys.guildRoster(this.guildId));
    const lookup = buildEntityLookup(this.store);
    return `
      ${LayoutViewModel.pageHeader({
        title: "Bulk operations",
        subtitle: "Select players, then apply a bulk action.",
        actionsHtml: `<a class="btn btn-light btn-sm" href="/players" data-action="back"><i class="bi bi-chevron-left me-1"></i>Back to roster</a>`,
      })}
      ${ResourceView.render(roster, {
        success: (rows) => {
          const list = Array.isArray(rows) ? rows : [];
          const checkboxes = list
            .map(
              (r) => `
            <label class="d-flex align-items-center gap-2 p-2 border-bottom">
              <input type="checkbox" class="form-check-input" data-player-id="${escapeAttr(r.id)}" ${this.selected.has(r.id) ? "checked" : ""} />
              <span>${renderEntityLink(r.id, lookup, { className: "small" })}</span>
            </label>`,
            )
            .join("");
          return `
            <div class="sg-card mb-3">
              <div class="sg-card__title">Players (${list.length})</div>
              <div style="max-height: 480px; overflow: auto;">${checkboxes}</div>
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-danger" data-action="kick">
                <i class="bi bi-person-x me-1"></i>Kick selected (${this.selected.size})
              </button>
              <button type="button" class="btn btn-light" data-action="migrate" disabled>
                <i class="bi bi-arrow-left-right me-1"></i>Migrate selected (coming soon)
              </button>
            </div>
          `;
        },
      })}
    `;
  }

  bind() {
    if (!this.container) return;
    this.container.querySelector('[data-action="back"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.router.goto("/players");
    });
    this.container.querySelectorAll("input[data-player-id]").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const target = /** @type {HTMLInputElement} */ (e.currentTarget);
        const id = target.dataset.playerId;
        if (!id) return;
        if (target.checked) this.selected.add(id);
        else this.selected.delete(id);
        this.update();
      });
    });
    this.container.querySelector('[data-action="kick"]')?.addEventListener("click", async () => {
      if (this.selected.size === 0) return;
      const ok = await NotificationDialogue.confirm({
        title: `Kick ${this.selected.size} player(s)?`,
        body: "This will submit a kick transaction for each selected player. They lose guild membership.",
        confirmLabel: "Kick",
        confirmVariant: "danger",
      });
      if (!ok) return;
      for (const id of this.selected) {
        const msg = this.playerManager.buildKickMessage(id, this.guildId);
        void this.store.tx?.enqueue(msg, { invalidate: [keys.guildRoster(this.guildId), keys.player(id)] });
      }
      notify.toast(`Enqueued ${this.selected.size} kick tx(s)`, "success");
      this.selected.clear();
      this.router.goto("/players");
    });
  }
}

function escapeAttr(s) {
  return String(s ?? "")
    .replace(/"/g, "&quot;")
    .replace(/&/g, "&amp;");
}
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
