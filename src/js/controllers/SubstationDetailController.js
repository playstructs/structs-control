import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { statCard } from "../view_models/components/StatCard.js";
import { notify } from "../store/notify.js";
import { success } from "../store/Resource.js";
import { readFormValues, validateForm, required, pattern } from "../util/validate.js";
import { keys } from "../store/keys.js";
import {
  allocationDestinationId,
  allocationId,
  allocationPowerRaw,
  allocationSourceId,
  formatAllocationPower,
} from "../util/allocationDisplay.js";
import { formatGridAttribute } from "../util/unitDisplay.js";
import { bindDataTable, gotoTableState, tableBindState } from "../util/bindDataTable.js";
import { parseFiltersFromParams, parseTableParams } from "../util/tableFilters.js";
import { milliwattRangeField } from "../util/tableFilterSchemas.js";
import { buildEntityLookup } from "../util/entityLookup.js";
import { renderEntityLink, renderEntityRef } from "../util/entityLink.js";

/** @param {import("../util/gridIndex.js").GridIndex | null} gridIndex */
function playerLookupFilterSchema(gridIndex) {
  return [
    milliwattRangeField("amount", "Amount", (row) => {
      if (!row.allocation) return null;
      return allocationPowerRaw(allocationId(row.allocation), gridIndex);
    }),
  ];
}

export class SubstationDetailController extends AbstractController {
  constructor(deps) {
    super("SubstationDetail", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.substationManager = deps.substationManager;
    this.allocationManager = deps.allocationManager;
    this.gridManager = deps.gridManager;
  }

  activate(_page, params) {
    const id = params.id;
    if (!id) {
      this.router.goto("/energy/substations");
      return;
    }
    void this.substationManager.fetchSubstation(id);
    void this.substationManager.fetchPlayers(id);
    void this.allocationManager.fetchBySource(id);
    this.layout.mountContent(
      new SubstationDetailViewModel({
        store: this.store,
        router: this.router,
        id,
        allocationManager: this.allocationManager,
        gridManager: this.gridManager,
        params: params ?? {},
      }),
    );
  }
}

/**
 * Merge connected players with outbound allocations (keyed by destination).
 * @param {import("../types/api.js").PlayerData[]} players
 * @param {import("../types/api.js").AllocationData[]} allocations
 */
function buildPlayerLookupRows(players, allocations) {
  /** @type {Map<string, import("../types/api.js").AllocationData>} */
  const byDestination = new Map();
  for (const row of allocations) {
    const dest = allocationDestinationId(row);
    if (dest && dest !== "—") byDestination.set(dest, row);
  }

  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {Array<{ playerId: string, name?: string, allocation: import("../types/api.js").AllocationData | null }>} */
  const merged = [];

  for (const p of players) {
    if (!p?.id) continue;
    seen.add(p.id);
    merged.push({
      playerId: p.id,
      name: p.name,
      allocation: byDestination.get(p.id) ?? null,
    });
  }

  for (const row of allocations) {
    const dest = allocationDestinationId(row);
    if (!dest || dest === "—" || seen.has(dest)) continue;
    merged.push({ playerId: dest, allocation: row });
  }

  return merged;
}

class SubstationDetailViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.id = deps.id;
    this.allocationManager = deps.allocationManager;
    this.gridManager = deps.gridManager;
    this.params = deps.params;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.substation(this.id));
    this.subscribe(this.store, keys.substationPlayers(this.id));
    this.subscribe(this.store, keys.allocationBySource(this.id));
    this.subscribe(this.store, keys.gridIndex());
  }

  /** @returns {import("../util/gridIndex.js").GridIndex | null} */
  _gridIndex() {
    const res = this.store.read(keys.gridIndex());
    return res.status === "success" && res.data && typeof res.data === "object"
      ? /** @type {import("../util/gridIndex.js").GridIndex} */ (res.data)
      : null;
  }

  render() {
    const sub = this.store.read(keys.substation(this.id));
    const players = this.store.read(keys.substationPlayers(this.id));
    const allocs = this.store.read(keys.allocationBySource(this.id));
    const gridIndex = this._gridIndex();
    const defaultController = this.store.session?.data?.playerId ?? "";
    const playerRows = players.status === "success" && Array.isArray(players.data) ? players.data : [];
    const allocRows = allocs.status === "success" && Array.isArray(allocs.data) ? allocs.data : [];
    const subData = sub.status === "success" ? sub.data : null;
    const lookup = buildEntityLookup(this.store, {
      players: playerRows,
      substations: subData ? [/** @type {import("../types/api.js").SubstationData} */ (subData)] : [],
    });
    const substationLabel =
      subData && typeof subData === "object" && subData.name ? `${subData.name} (${this.id})` : this.id;
    const lookupRows = buildPlayerLookupRows(playerRows, allocRows);

    return `
      ${LayoutViewModel.pageHeader({
        title: "Substation",
        subtitle: substationLabel,
        actionsHtml: `<a class="btn btn-light btn-sm" href="/energy/substations" data-action="back"><i class="bi bi-chevron-left me-1"></i>Back</a>`,
      })}
      ${ResourceView.render(sub, {
        success: (s) => `
          <div class="sg-stat-grid">
            ${statCard({ label: "Name", value: s?.name ?? "—" })}
            ${statCard({ label: "Owner", valueHtml: renderEntityRef(s?.owner, lookup) })}
            ${statCard({ label: "Creator", valueHtml: renderEntityRef(s?.creator, lookup) })}
          </div>
        `,
      })}
      <div class="sg-card mt-3">
        <div class="sg-card__title">Player lookup</div>
        <p class="text-secondary small mb-3">Players in this substation and their power allocations.</p>
        ${players.status === "loading" || allocs.status === "loading"
          ? `<div class="sg-empty"><div class="sg-empty__hint">Loading…</div></div>`
          : ResourceView.render(success(lookupRows), {
            success: (rows) => {
              const filterSchema = playerLookupFilterSchema(gridIndex);
              const filters = parseFiltersFromParams(this.params, "", filterSchema);
              const t = new DataTable({
                id: "player-lookup-table",
                filterSchema,
                filters,
                embedded: true,
                searchColumns: [
                  { id: "player", label: "Player" },
                  { id: "playerId", label: "Player ID" },
                  { id: "source", label: "Source" },
                ],
                columns: [
                  {
                    id: "player",
                    label: "Player",
                    get: (row) => row.name ?? row.playerId,
                    sort: (a, b) => String(a.name ?? a.playerId).localeCompare(String(b.name ?? b.playerId)),
                    render: (_v, row) => renderEntityLink(row.playerId, lookup),
                  },
                  {
                    id: "amount",
                    label: "Amount",
                    align: "end",
                    get: (row) =>
                      row.allocation
                        ? formatAllocationPower(row.allocation, gridIndex)
                        : formatGridAttribute("power", undefined),
                  },
                  {
                    id: "source",
                    label: "Power source",
                    get: (row) => (row.allocation ? allocationSourceId(row.allocation) : "—"),
                    render: (v) => renderEntityRef(v, lookup),
                  },
                  {
                    id: "playerId",
                    label: "Player ID",
                    get: (row) => row.playerId,
                    render: (v) => renderEntityRef(v, lookup),
                  },
                  {
                    id: "actions",
                    label: "",
                    align: "end",
                    get: () => "",
                    render: (_v, row) =>
                      row.allocation
                        ? `<button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-alloc" data-id="${escapeAttr(allocationId(row.allocation))}">Delete</button>`
                        : "",
                  },
                ],
                rows: Array.isArray(rows) ? rows : [],
                emptyMessage: "No players connected to this substation.",
                ...parseTableParams(this.params),
              });
              return t.renderHTML();
            },
          })}
      </div>
      <div class="sg-card mt-3">
        <div class="sg-card__title">Create allocation</div>
        <form id="form-alloc-create" class="row g-3">
          <div class="col-md-3">
            <label class="form-label small text-secondary" for="alloc-source">Source</label>
            <input id="alloc-source" name="source_object_id" type="text" class="form-control font-monospace" value="${escapeAttr(this.id)}" readonly />
          </div>
          <div class="col-md-3">
            <label class="form-label small text-secondary" for="alloc-controller">Controller (player ID)</label>
            <input id="alloc-controller" name="controller" type="text" class="form-control font-monospace" value="${escapeAttr(defaultController)}" />
            <div class="invalid-feedback"></div>
          </div>
          <div class="col-md-3">
            <label class="form-label small text-secondary" for="alloc-type">Type</label>
            <select id="alloc-type" name="allocation_type" class="form-select">
              <option value="static">static</option>
              <option value="dynamic">dynamic</option>
              <option value="automated" selected>automated</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label small text-secondary" for="alloc-power">Power</label>
            <input id="alloc-power" name="power" type="text" class="form-control" placeholder="0" />
            <div class="invalid-feedback"></div>
          </div>
          <div class="col-md-1 d-flex align-items-end">
            <button type="button" class="btn btn-primary w-100" data-action="create-alloc">Create</button>
          </div>
        </form>
      </div>
    `;
  }

  bind() {
    if (!this.container) return;
    this.container.querySelector('[data-action="back"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.router.goto("/energy/substations");
    });

    const createSchema = {
      controller: [required()],
      power: [required(), pattern(/^\d+$/, "Whole numbers only")],
    };

    this.container.querySelector('[data-action="create-alloc"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const container = this.container;
      if (!container) return;
      const form = /** @type {HTMLFormElement | null} */ (container.querySelector("#form-alloc-create"));
      if (!form) return;
      const v = readFormValues(form);
      const { valid, errors } = validateForm(createSchema, v);
      if (!valid) return notify.formError("form-alloc-create", errors);
      void this.allocationManager.enqueueCreate({
        sourceObjectId: v.source_object_id || this.id,
        controller: v.controller,
        allocationType: v.allocation_type,
        power: v.power,
      });
      notify.toast("Allocation create enqueued", "info");
    });

    this.container.querySelectorAll('[data-action="delete-alloc"]').forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = /** @type {HTMLElement} */ (btn).dataset.id;
        if (!id || !window.confirm(`Delete allocation ${id}?`)) return;
        void this.allocationManager.enqueueDelete({ allocationId: id, sourceId: this.id });
        notify.toast("Delete enqueued", "info");
      }),
    );

    const filterSchema = playerLookupFilterSchema(this._gridIndex());
    const { id: _routeId, ...tableParams } = this.params;
    bindDataTable(
      this.container.querySelector("#player-lookup-table"),
      {
        id: "player-lookup-table",
        filterSchema,
        filters: parseFiltersFromParams(this.params, "", filterSchema),
        ...tableBindState(this.params),
      },
      {
        onChange: (next) =>
          gotoTableState(this.router, `/energy/substations/${this.id}`, tableParams, next, filterSchema),
      },
    );
  }
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
