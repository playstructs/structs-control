import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { tableSectionCard, TABLE_SECTION_ICON } from "../view_models/components/TableSectionCard.js";
import { energyGridActivityCard } from "../view_models/components/EnergyGridCard.js";
import { confirmMigrate } from "../framework/MigrateConfirmDialogue.js";
import { notify } from "../store/notify.js";
import { keys } from "../store/keys.js";
import { bindDataTable, gotoTableState, tableBindState } from "../util/bindDataTable.js";
import { parseFiltersFromParams, parseTableParams } from "../util/tableFilters.js";
import { milliwattRangeField, parseNumeric, rangeFilterField } from "../util/tableFilterSchemas.js";
import { buildEntityLookup } from "../util/entityLookup.js";
import { renderEntityLink, renderEntityRef } from "../util/entityLink.js";
import { pfpAvatar } from "../view_models/components/PfpViewer.js";
import {
  capacityBarHtml,
  capacityPercent,
  computeEnergyGridActivityCards,
  formatKw,
  formatPercentChange,
  parsePlayerIdsParam,
  perPlayerDraw,
  percentChange,
  serializePlayerIdsParam,
  substationGridAttrs,
} from "../util/energyGrid.js";
import { coalesceNumeric } from "../util/unitDisplay.js";

const SUB_PREFIX = "s.";
const PLAYER_PREFIX = "p.";

/** @param {import("../managers/GridManager.js").GridManager} gridManager */
function substationsFilterSchema(gridManager) {
  return [
    milliwattRangeField("capacity", "Capacity", (r) => substationGridAttrs(r, gridManager).capacity),
    milliwattRangeField("load", "Load", (r) => substationGridAttrs(r, gridManager).load),
    rangeFilterField("players", "Players", (r) => parseNumeric(r.player_count)),
  ];
}

/** @param {import("../managers/GridManager.js").GridManager} gridManager @param {import("../types/api.js").PlayerData[]} migrating */
function migrateSubstationFilterSchema(gridManager, migrating) {
  return [
    milliwattRangeField("capacity", "Capacity", (r) => substationGridAttrs(r, gridManager).capacity),
    milliwattRangeField("load", "Load", (r) => substationGridAttrs(r, gridManager).load),
    rangeFilterField("players", "Players", (r) => parseNumeric(r.player_count)),
    milliwattRangeField("newDraw", "New Per Player Draw", (r) => {
      const attrs = substationGridAttrs(r, gridManager);
      const addedLoad = migrating.reduce((sum, p) => sum + coalesceNumeric(p.load, 0), 0);
      const count = (r.player_count ?? 0) + migrating.length;
      return perPlayerDraw(coalesceNumeric(attrs.load, 0) + addedLoad, count);
    }),
  ];
}

export class EnergyGridController extends AbstractController {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   layout: import("../view_models/LayoutViewModel.js").LayoutViewModel,
   *   router: import("../framework/MenuPageRouter.js").MenuPageRouter,
   *   substationManager: import("../managers/SubstationManager.js").SubstationManager,
   *   guildManager: import("../managers/GuildManager.js").GuildManager,
   *   gridManager: import("../managers/GridManager.js").GridManager,
   * }} deps
   */
  constructor(deps) {
    super("EnergyGrid", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.substationManager = deps.substationManager;
    this.guildManager = deps.guildManager;
    this.gridManager = deps.gridManager;
  }

  activate(page, params) {
    const session = this.store.session?.data;
    if (!session) return;

    void this.substationManager.fetchList();
    void this.gridManager.fetchIndex();
    void this.substationManager.fetchGridPlayers(session.guildId);

    const deps = {
      store: this.store,
      router: this.router,
      guildId: session.guildId,
      substationManager: this.substationManager,
      gridManager: this.gridManager,
      params: params ?? {},
    };

    if (page === "migrateSuccess") {
      this.layout.mountContent(new EnergyGridSuccessViewModel(deps));
      return;
    }
    if (page === "migrate") {
      this.layout.mountContent(new EnergyGridMigrateViewModel(deps));
      return;
    }
    this.layout.mountContent(new EnergyGridIndexViewModel(deps));
  }
}

/** @param {import("../types/api.js").SubstationData} row @param {ReturnType<typeof buildEntityLookup>} lookup */
function substationNameCell(row, lookup) {
  const label = row.name ?? row.id;
  return `<span class="sg-substation-cell">
    <span class="sg-substation-cell__thumb" aria-hidden="true"><i class="bi bi-hdd-rack"></i></span>
    ${renderEntityLink(row.id, lookup, { label })}
  </span>`;
}

/**
 * @param {import("../managers/GridManager.js").GridManager} gridManager
 * @param {import("../types/api.js").PlayerData[]} [migrating]
 * @param {boolean} [impactColumns]
 */
function substationColumns(gridManager, migrating = [], impactColumns = false) {
  const migratingLoad = migrating.reduce((sum, p) => sum + coalesceNumeric(p.load, 0), 0);
  /** @type {import("../view_models/components/DataTable.js").DataTable["props"]["columns"]} */
  const cols = [
    {
      id: "name",
      label: "Substation",
      get: (r) => r.name ?? r.id,
      sort: (a, b) => String(a.name ?? a.id).localeCompare(String(b.name ?? b.id)),
    },
    {
      id: "maxCap",
      label: "Max Cap",
      get: (r) => {
        const { load, capacity } = substationGridAttrs(r, gridManager);
        return capacityPercent(load, capacity);
      },
      render: (_v, row) => {
        const { load, capacity } = substationGridAttrs(row, gridManager);
        return capacityBarHtml(load, capacity);
      },
    },
    {
      id: "maxCapPct",
      label: "Max Cap %",
      get: (r) => {
        const { load, capacity } = substationGridAttrs(r, gridManager);
        return capacityPercent(load, capacity);
      },
      align: "end",
      render: (v) => (v == null ? "—" : `${v}%`),
    },
    {
      id: "powerIn",
      label: "Power Input",
      get: (r) => substationGridAttrs(r, gridManager).powerIn,
      render: (v) => formatKw(v),
      align: "end",
    },
    {
      id: "powerOut",
      label: "Power Output",
      get: (r) => substationGridAttrs(r, gridManager).powerOut,
      render: (v) => formatKw(v),
      align: "end",
    },
  ];

  if (impactColumns && migrating.length) {
    cols.push(
      {
        id: "newDraw",
        label: "New Per Player Draw",
        get: (r) => {
          const { load } = substationGridAttrs(r, gridManager);
          const count = (r.player_count ?? 0) + migrating.length;
          return perPlayerDraw(coalesceNumeric(load, 0) + migratingLoad, count);
        },
        render: (v) => formatKw(v),
        align: "end",
      },
      {
        id: "oldDraw",
        label: "Old Per Player Draw",
        get: (r) => {
          const { load } = substationGridAttrs(r, gridManager);
          return perPlayerDraw(load, r.player_count);
        },
        render: (v) => formatKw(v),
        align: "end",
      },
      {
        id: "drawChange",
        label: "% Change Per Player",
        get: (r) => {
          const { load } = substationGridAttrs(r, gridManager);
          const oldDraw = perPlayerDraw(load, r.player_count);
          const newDraw = perPlayerDraw(
            coalesceNumeric(load, 0) + migratingLoad,
            (r.player_count ?? 0) + migrating.length,
          );
          return percentChange(newDraw, oldDraw);
        },
        render: (v) => formatPercentChange(v),
        align: "end",
      },
    );
  }

  return cols;
}

class EnergyGridIndexViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.guildId = deps.guildId;
    this.substationManager = deps.substationManager;
    this.gridManager = deps.gridManager;
    this.params = deps.params;
    /** @type {Set<string>} */
    this.selectedPlayers = new Set();
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.substationList());
    this.subscribe(this.store, keys.gridIndex());
    this.subscribe(this.store, keys.energyGridPlayers(this.guildId));
  }

  render() {
    const substations = this.store.read(keys.substationList());
    const lookup = buildEntityLookup(this.store);
    const params = this.params;
    const gridPlayers = this.store.read(keys.energyGridPlayers(this.guildId));

    const activityHtml =
      substations.status === "success" && Array.isArray(substations.data)
        ? computeEnergyGridActivityCards(substations.data, this.gridManager)
            .map((c) => energyGridActivityCard(c))
            .join("")
        : "";

    const subFilterSchema = substationsFilterSchema(this.gridManager);
    const subFilters = parseFiltersFromParams(params, SUB_PREFIX, subFilterSchema);

    const substationBody = ResourceView.render(substations, {
      success: (rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const table = new DataTable({
          id: "energy-substations-table",
          embedded: true,
          paramPrefix: SUB_PREFIX,
          filterSchema: subFilterSchema,
          filters: subFilters,
          searchColumns: [
            { id: "name", label: "Substation" },
            { id: "id", label: "Substation ID" },
          ],
          columns: substationColumns(this.gridManager).map((c) =>
            c.id === "name"
              ? {
                  ...c,
                  render: (_v, row) => substationNameCell(row, lookup),
                }
              : c,
          ),
          rows: list,
          keyFn: (r) => String(r.id),
          onRowClick: (r) => `/energy/substations/${r.id}`,
          ...parseTableParams(params, SUB_PREFIX),
          pageSize: 11,
          emptyMessage: "No substations in this guild yet.",
        });
        return tableSectionCard({
          icon: TABLE_SECTION_ICON,
          title: "Substations",
          subtitle: "Substations in your guild.",
          bodyHtml: table.renderHTML(),
        });
      },
    });

    const playerFilterSchema = [rangeFilterField("capacityPct", "Capacity %", (r) => playerCapacityPct(r))];
    const playerFilters = parseFiltersFromParams(params, PLAYER_PREFIX, playerFilterSchema);
    const migrateDisabled = this.selectedPlayers.size === 0;
    const migrateBtn = `<button type="button" class="sg-btn-migrate" data-action="migrate-players" ${migrateDisabled ? "disabled" : ""}><i class="bi bi-arrow-bar-right"></i> Migrate</button>`;

    const playerSubtitle = "Players in the energy grid.";

    const playerBody = ResourceView.render(gridPlayers, {
      success: (rows) => {
        const list = Array.isArray(rows) ? rows : [];
          const table = new DataTable({
            id: "energy-players-table",
            embedded: true,
            paramPrefix: PLAYER_PREFIX,
            filterSchema: playerFilterSchema,
            filters: playerFilters,
            selectable: true,
            selectedKeys: this.selectedPlayers,
            searchColumns: [
              { id: "name", label: "Player" },
              { id: "id", label: "Player ID" },
            ],
            toolbarActionsHtml: migrateBtn,
            columns: [
              {
                id: "name",
                label: "Player Name",
                get: (r) => r.name ?? r.id,
                sort: (a, b) => String(a.name ?? a.id).localeCompare(String(b.name ?? b.id)),
                render: (_v, row) =>
                  `<span class="d-inline-flex align-items-center gap-2">${pfpAvatar({
                    attributes: row?.pfp_client_render_attributes ?? null,
                    size: "sm",
                  })}${renderEntityLink(row.id, lookup)}</span>`,
              },
              {
                id: "substation",
                label: "Substation",
                get: (r) => r.substation_id ?? "—",
                render: (v) => renderEntityRef(v, lookup),
              },
              {
                id: "id",
                label: "Player ID",
                get: (r) => r.id,
                render: (v) => `<span class="sg-datatable__cell-mono">${escapeHtml(v)}</span>`,
              },
              {
                id: "capacityPct",
                label: "Capacity",
                get: (r) => playerCapacityPct(r),
                align: "end",
                render: (v) => (v == null ? "—" : `${v}%`),
              },
              {
                id: "status",
                label: "Status",
                get: (r) => (r.last_action_block_height ? "Online" : "—"),
                render: (v) =>
                  v === "Online"
                    ? `<span class="sg-status-dot sg-status-dot--online">${escapeHtml(v)}</span>`
                    : escapeHtml(String(v)),
              },
            ],
            rows: list,
            keyFn: (r) => String(r.id),
            onRowClick: (r) => `/players/${r.id}`,
            ...parseTableParams(params, PLAYER_PREFIX),
            pageSize: 11,
            emptyMessage: "No players connected to the energy grid.",
          });
          return tableSectionCard({
            icon: "bi-person-circle",
            title: "Player Lookup",
            subtitle: playerSubtitle,
            bodyHtml: table.renderHTML(),
          });
        },
      });

    return `
      <div class="sg-energy-grid">
        <div class="sg-energy-grid__activity">${activityHtml}</div>
        <div class="sg-energy-grid__tables">
          ${substationBody}
          ${playerBody}
        </div>
      </div>
    `;
  }

  bind() {
    if (!this.container) return;
    this._bindSubstationTable();
    this._bindPlayerTable();
  }

  _bindSubstationTable() {
    const root = this.container?.querySelector("#energy-substations-table");
    if (!root) return;
    const subFilterSchema = substationsFilterSchema(this.gridManager);
    const params = this.params;
    bindDataTable(
      root,
      {
        id: "energy-substations-table",
        paramPrefix: SUB_PREFIX,
        filterSchema: subFilterSchema,
        filters: parseFiltersFromParams(params, SUB_PREFIX, subFilterSchema),
        ...tableBindState(params, SUB_PREFIX),
      },
      {
        onChange: (next) => gotoTableState(this.router, "/energy/grid", params, next, subFilterSchema, SUB_PREFIX),
        onNavigate: (path) => this.router.goto(path),
      },
    );
  }

  _bindPlayerTable() {
    const root = this.container?.querySelector("#energy-players-table");
    if (!root) return;
    const playerFilterSchema = [rangeFilterField("capacityPct", "Capacity %", (r) => playerCapacityPct(r))];
    const params = this.params;

    bindDataTable(
      root,
      {
        id: "energy-players-table",
        paramPrefix: PLAYER_PREFIX,
        filterSchema: playerFilterSchema,
        filters: parseFiltersFromParams(params, PLAYER_PREFIX, playerFilterSchema),
        selectable: true,
        selectedKeys: this.selectedPlayers,
        ...tableBindState(params, PLAYER_PREFIX),
      },
      {
        onChange: (next) =>
          gotoTableState(this.router, "/energy/grid", params, next, playerFilterSchema, PLAYER_PREFIX),
        onNavigate: (path) => this.router.goto(path),
        onSelectionChange: (keys) => {
          this.selectedPlayers = keys;
          this.update();
        },
      },
    );

    root.querySelector('[data-action="migrate-players"]')?.addEventListener("click", () => {
      if (!this.selectedPlayers.size) return;
      const qs = serializePlayerIdsParam([...this.selectedPlayers]);
      this.router.goto(`/energy/grid/migrate?players=${encodeURIComponent(qs)}`);
    });
  }
}

class EnergyGridMigrateViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.guildId = deps.guildId;
    this.substationManager = deps.substationManager;
    this.gridManager = deps.gridManager;
    this.params = deps.params;
    this.playerIds = parsePlayerIdsParam(String(deps.params?.players ?? ""));
    /** @type {string} */
    this.selectedDestId = "";
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.substationList());
    this.subscribe(this.store, keys.gridIndex());
    this.subscribe(this.store, keys.energyGridPlayers(this.guildId));
  }

  /** @returns {import("../types/api.js").PlayerData[]} */
  _migratingPlayers() {
    const res = this.store.read(keys.energyGridPlayers(this.guildId));
    const rows = res.status === "success" && Array.isArray(res.data) ? res.data : [];
    const byId = new Map(rows.map((p) => [String(p.id), p]));
    return this.playerIds.map((id) => byId.get(id) ?? { id });
  }

  render() {
    const substations = this.store.read(keys.substationList());
    const lookup = buildEntityLookup(this.store);
    const params = this.params;
    const migrating = this._migratingPlayers();
    const filterSchema = migrateSubstationFilterSchema(this.gridManager, migrating);
    const filters = parseFiltersFromParams(params, "", filterSchema);

    if (!this.playerIds.length) {
      return `
        <div class="sg-energy-migrate">
          <a class="sg-energy-migrate__back" href="/energy/grid" data-spa-link><i class="bi bi-arrow-left"></i> back to Energy Grid</a>
          <h1 class="sg-energy-migrate__title">Select a Substation</h1>
          <p class="text-muted">No players selected. Return to the grid and choose players to migrate.</p>
        </div>`;
    }

    const body = ResourceView.render(substations, {
      success: (rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const table = new DataTable({
          id: "energy-migrate-substations",
          embedded: true,
          filterSchema,
          filters,
          selectable: true,
          selectionMode: "radio",
          selectedKeys: this.selectedDestId ? new Set([this.selectedDestId]) : new Set(),
          searchColumns: [
            { id: "name", label: "Substation" },
            { id: "id", label: "Substation ID" },
          ],
          columns: substationColumns(this.gridManager, migrating, true).map((c) =>
            c.id === "name" ? { ...c, render: (_v, row) => substationNameCell(row, lookup) } : c,
          ),
          rows: list,
          keyFn: (r) => String(r.id),
          ...parseTableParams(params),
          pageSize: 6,
          emptyMessage: "No substations available.",
        });
        return tableSectionCard({
          icon: TABLE_SECTION_ICON,
          title: "Substations",
          subtitle: "Substations in your guild.",
          bodyHtml: table.renderHTML(),
        });
      },
    });

    return `
      <div class="sg-energy-migrate">
        <a class="sg-energy-migrate__back" href="/energy/grid" data-spa-link><i class="bi bi-arrow-left"></i> back to Energy Grid</a>
        <h1 class="sg-energy-migrate__title">Select a Substation</h1>
        ${body}
        <div class="sg-energy-migrate__actions">
          <a class="sg-btn-lunar" href="/energy/grid" data-spa-link>Cancel</a>
          <button type="button" class="sg-btn-success-fill" data-action="confirm-migrate" ${this.selectedDestId ? "" : "disabled"}>Migrate Players</button>
        </div>
      </div>
    `;
  }

  bind() {
    if (!this.container || !this.playerIds.length) return;
    const root = this.container.querySelector("#energy-migrate-substations");
    const migrating = this._migratingPlayers();
    const filterSchema = migrateSubstationFilterSchema(this.gridManager, migrating);
    const params = this.params;

    if (root) {
      bindDataTable(
        root,
        {
          id: "energy-migrate-substations",
          filterSchema,
          filters: parseFiltersFromParams(params, "", filterSchema),
          selectable: true,
          selectionMode: "radio",
          selectedKeys: this.selectedDestId ? new Set([this.selectedDestId]) : new Set(),
          ...tableBindState(params),
        },
        {
          onChange: (next) =>
            gotoTableState(
              this.router,
              "/energy/grid/migrate",
              { ...params, players: serializePlayerIdsParam(this.playerIds) },
              next,
              filterSchema,
            ),
          onSelectionChange: (keys) => {
            this.selectedDestId = [...keys][0] ?? "";
            this.update();
          },
        },
      );
    }

    this.container.querySelector('[data-action="confirm-migrate"]')?.addEventListener("click", () => {
      void this._confirmAndMigrate();
    });
  }

  async _confirmAndMigrate() {
    if (!this.selectedDestId) return;
    const substations = this.store.read(keys.substationList());
    const destRow =
      substations.status === "success" && Array.isArray(substations.data)
        ? substations.data.find((s) => String(s.id) === this.selectedDestId)
        : null;
    const destName = String(destRow?.name || destRow?.id || this.selectedDestId).trim();
    const migrating = this._migratingPlayers();
    const names = migrating.map((p) => p.name ?? p.id ?? "Player");
    const ok = await confirmMigrate({
      playerCount: this.playerIds.length,
      playerNames: names,
      destName,
    });
    if (!ok) return;

    const creator = this.store.session?.data?.address ?? "";
    const sourceIds = [...new Set(migrating.map((p) => String(p.substation_id ?? "")).filter(Boolean))];
    void this.substationManager.enqueueMigrate(creator, this.selectedDestId, this.playerIds, this.guildId, sourceIds);
    notify.toast(`Enqueued migration of ${this.playerIds.length} player(s)`, "success");
    const qs = new URLSearchParams({
      dest: this.selectedDestId,
      players: serializePlayerIdsParam(this.playerIds),
    });
    this.router.goto(`/energy/grid/migrate/success?${qs}`);
  }
}

class EnergyGridSuccessViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.guildId = deps.guildId;
    this.gridManager = deps.gridManager;
    this.params = deps.params;
    this.destId = String(deps.params?.dest ?? "");
    this.playerIds = parsePlayerIdsParam(String(deps.params?.players ?? ""));
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.substationList());
    this.subscribe(this.store, keys.gridIndex());
    this.subscribe(this.store, keys.energyGridPlayers(this.guildId));
  }

  render() {
    const lookup = buildEntityLookup(this.store);
    const substations = this.store.read(keys.substationList());
    const gridRes = this.store.read(keys.energyGridPlayers(this.guildId));
    const gridRows = gridRes.status === "success" && Array.isArray(gridRes.data) ? gridRes.data : [];
    const byId = new Map(gridRows.map((p) => [String(p.id), p]));
    const players = this.playerIds.map((id) => byId.get(id) ?? { id });
    const destRow =
      substations.status === "success" && Array.isArray(substations.data)
        ? substations.data.find((s) => String(s.id) === this.destId)
        : null;
    const destName = destRow?.name ?? lookup.substations.get(this.destId)?.name ?? this.destId;
    const migratingLoad = players.reduce((sum, p) => sum + coalesceNumeric(p.load, 0), 0);
    const attrs = destRow ? substationGridAttrs(destRow, this.gridManager) : { load: 0 };
    const oldDraw = perPlayerDraw(attrs.load, destRow?.player_count);
    const newDraw = perPlayerDraw(
      coalesceNumeric(attrs.load, 0) + migratingLoad,
      (destRow?.player_count ?? 0) + players.length,
    );
    const change = percentChange(newDraw, oldDraw);

    const summaryTable = destRow
      ? new DataTable({
          id: "energy-success-substation",
          embedded: true,
          hideToolbar: true,
          columns: [
            {
              id: "name",
              label: "Substation",
              get: () => destName,
              render: () => substationNameCell(destRow, lookup),
            },
            {
              id: "newDraw",
              label: "New Per Player Draw",
              get: () => newDraw,
              render: (v) => formatKw(v),
              align: "end",
            },
            {
              id: "oldDraw",
              label: "Previous Per Player Draw",
              get: () => oldDraw,
              render: (v) => formatKw(v),
              align: "end",
            },
            {
              id: "change",
              label: "% Change Per Player",
              get: () => change,
              render: (v) => formatPercentChange(v),
              align: "end",
            },
          ],
          rows: [destRow],
          hideFooter: true,
        }).renderHTML()
      : `<p class="text-muted">Substation summary unavailable.</p>`;

    const playersTable = new DataTable({
      id: "energy-success-players",
      embedded: true,
      hideToolbar: true,
      columns: [
        {
          id: "name",
          label: "Player Name",
          get: (r) => r.name ?? r.id,
          render: (_v, row) =>
            `<span class="d-inline-flex align-items-center gap-2">${pfpAvatar({
              attributes: row?.pfp_client_render_attributes ?? null,
              size: "sm",
            })}${renderEntityLink(row.id, lookup)}</span>`,
        },
        {
          id: "prevSub",
          label: "Previous Substation",
          get: (r) => r.substation_id ?? "—",
          render: (v) => (v === "—" ? "—" : renderEntityRef(v, lookup)),
        },
        {
          id: "newSub",
          label: "New Substation",
          get: () => destName,
          render: () => renderEntityRef(this.destId, lookup),
        },
        {
          id: "newCap",
          label: "New Capacity",
          get: (r) => playerCapacityPct({ ...r, substation_id: this.destId }),
          align: "end",
          render: (v) => (v == null ? "—" : `${v}%`),
        },
        {
          id: "oldCap",
          label: "Old Capacity",
          get: (r) => playerCapacityPct(r),
          align: "end",
          render: (v) => (v == null ? "—" : `${v}%`),
        },
      ],
      rows: players,
      hideFooter: players.length <= 11,
      pageSize: 11,
    }).renderHTML();

    return `
      <div class="sg-energy-success">
        <a class="sg-energy-migrate__back" href="/energy/grid" data-spa-link><i class="bi bi-arrow-left"></i> back to Energy Grid</a>
        <div class="sg-energy-success__hero">
          <span class="sg-energy-success__icon" aria-hidden="true"><i class="bi bi-check-circle-fill"></i></span>
          <h1 class="sg-energy-success__title">Migration Successful</h1>
          <p class="sg-energy-success__subtitle">You've successfully migrated players into the substation!</p>
        </div>
        ${tableSectionCard({
          icon: TABLE_SECTION_ICON,
          title: "Substation Summary",
          subtitle: "Substation stats summary.",
          bodyHtml: summaryTable,
        })}
        ${tableSectionCard({
          icon: "bi-people",
          title: "Players Summary",
          subtitle: "List of migrated players.",
          bodyHtml: playersTable,
        })}
        <div class="sg-energy-migrate__actions">
          <a class="sg-btn-success-fill" href="/energy/grid" data-spa-link>Next</a>
        </div>
      </div>
    `;
  }
}

/** @param {import("../types/api.js").PlayerData} player */
function playerCapacityPct(player) {
  const cap = coalesceNumeric(player.capacity, 0);
  const load = coalesceNumeric(player.load, 0);
  if (cap <= 0) return null;
  return Math.round((load / cap) * 100);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
