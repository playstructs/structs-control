import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { tableSectionCard, TABLE_SECTION_ICON } from "../view_models/components/TableSectionCard.js";
import { notify } from "../store/notify.js";
import { keys } from "../store/keys.js";
import { bindDataTable, gotoTableState, tableBindState } from "../util/bindDataTable.js";
import { hasActiveFilters, parseFiltersFromParams, parseTableParams } from "../util/tableFilters.js";
import { checkboxFilterField } from "../util/tableFilterSchemas.js";
import { buildEntityLookup } from "../util/entityLookup.js";
import { renderEntityLink } from "../util/entityLink.js";
import { pfpAvatar } from "../view_models/components/PfpViewer.js";
import { ENERGY_PERMISSION_COLUMNS, ENERGY_PERMISSION_MASK, hasPerm, setPerm } from "../constants/Permissions.js";
import { promptSetPermissions } from "../framework/SetPermissionsDialogue.js";
import { NotificationDialogue } from "../framework/NotificationDialogue.js";

const PREFIX = "";
const ON_OFF = [
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
];

/** @param {string} id @param {string} label @param {number} bit */
function permFilterField(id, label, bit) {
  return checkboxFilterField(id, label, ON_OFF, (row) => (hasPerm(row.mask, bit) ? "on" : "off"));
}

function permissionsFilterSchema() {
  return ENERGY_PERMISSION_COLUMNS.map((col) => permFilterField(col.id, col.label, col.bit));
}

/**
 * Energy → Permissions (Figma Flows `1902:64550` / table `1342:32565`).
 */
export class PermissionsController extends AbstractController {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   layout: import("../view_models/LayoutViewModel.js").LayoutViewModel,
   *   router: import("../framework/MenuPageRouter.js").MenuPageRouter,
   *   substationManager: import("../managers/SubstationManager.js").SubstationManager,
   *   guildManager: import("../managers/GuildManager.js").GuildManager,
   *   permissionManager: import("../managers/PermissionManager.js").PermissionManager,
   * }} deps
   */
  constructor(deps) {
    super("Permissions", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.substationManager = deps.substationManager;
    this.guildManager = deps.guildManager;
    this.permissionManager = deps.permissionManager;
  }

  activate(_page, params) {
    const session = this.store.session?.data;
    if (!session) return;

    void this.substationManager.fetchList().then(() => {
      const fromParams = String(params?.substation ?? "");
      if (fromParams) return;
      const substations = this.store.read(keys.substationList());
      const list = substations.status === "success" && Array.isArray(substations.data) ? substations.data : [];
      const first = list[0]?.id;
      if (first) this.router.goto(`/energy/permissions?substation=${encodeURIComponent(String(first))}`);
    });
    void this.guildManager.fetchRoster(session.guildId);

    const fromParams = String(params?.substation ?? "");
    const substations = this.store.read(keys.substationList());
    const list = substations.status === "success" && Array.isArray(substations.data) ? substations.data : [];
    const objectId = fromParams || String(list[0]?.id ?? "");
    if (objectId) void this.permissionManager.fetchByObject(objectId);

    this.layout.mountContent(
      new PermissionsViewModel({
        store: this.store,
        router: this.router,
        guildId: session.guildId,
        permissionManager: this.permissionManager,
        params: params ?? {},
        objectId,
      }),
    );
  }
}

class PermissionsViewModel extends AbstractViewModel {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   router: import("../framework/MenuPageRouter.js").MenuPageRouter,
   *   guildId: string,
   *   permissionManager: import("../managers/PermissionManager.js").PermissionManager,
   *   params: Record<string, string>,
   *   objectId: string,
   * }} deps
   */
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.guildId = deps.guildId;
    this.permissionManager = deps.permissionManager;
    this.params = deps.params;
    this.objectId = deps.objectId;
    /** @type {Set<string>} */
    this.selectedPlayers = new Set();
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.substationList());
    this.subscribe(this.store, keys.guildRoster(this.guildId));
    if (this.objectId) this.subscribe(this.store, keys.objectPermissions(this.objectId));
  }

  render() {
    const substations = this.store.read(keys.substationList());
    const roster = this.store.read(keys.guildRoster(this.guildId));
    const perms = this.objectId ? this.store.read(keys.objectPermissions(this.objectId)) : { status: "idle", data: null };
    const lookup = buildEntityLookup(this.store);
    const subList = substations.status === "success" && Array.isArray(substations.data) ? substations.data : [];
    const selectedSub = subList.find((s) => String(s.id) === this.objectId);
    const subLabel = selectedSub?.name || this.objectId || "substation";

    const picker = `
      <div class="sg-permissions__picker">
        <label class="form-label sg-permissions__picker-label" for="perm-substation">Substation</label>
        <select id="perm-substation" class="form-select sg-permissions__picker-select" data-action="pick-substation">
          ${
            subList.length
              ? subList
                  .map(
                    (s) =>
                      `<option value="${escapeAttr(s.id)}" ${String(s.id) === this.objectId ? "selected" : ""}>${escapeHtml(s.name || s.id)}</option>`,
                  )
                  .join("")
              : `<option value="">No substations</option>`
          }
        </select>
      </div>`;

    const filterSchema = permissionsFilterSchema();
    const filters = parseFiltersFromParams(this.params, PREFIX, filterSchema);

    const bulkDisabled = this.selectedPlayers.size === 0;
    const toolbar = `
      <div class="dropdown">
        <button type="button" class="sg-btn-lunar dropdown-toggle" data-bs-toggle="dropdown" ${bulkDisabled ? "disabled" : ""} aria-expanded="false">
          Bulk Actions
        </button>
        <ul class="dropdown-menu">
          <li><button type="button" class="dropdown-item" data-action="bulk-grant-all">Grant all permission bits</button></li>
          <li><button type="button" class="dropdown-item" data-action="bulk-revoke-all">Revoke all permission bits</button></li>
        </ul>
      </div>
      <button type="button" class="sg-btn-space" data-action="set-permissions" ${bulkDisabled ? "disabled" : ""}>
        Set Permissions
      </button>`;

    const body = ResourceView.render(roster, {
      missing: () =>
        tableSectionCard({
          icon: TABLE_SECTION_ICON,
          title: "Permissions",
          subtitle: `Permissions set for ${subLabel}`,
          bodyHtml: `${picker}<div class="sg-empty"><div class="sg-empty__hint">Guild roster unavailable.</div></div>`,
        }),
      success: (players) => {
        const maskByPlayer = permissionMaskMap(perms);
        const rows = (Array.isArray(players) ? players : []).map((p) => ({
          ...p,
          mask: maskByPlayer.get(String(p.id)) ?? 0,
        }));

        const permColumns = ENERGY_PERMISSION_COLUMNS.map((col) => ({
          id: col.id,
          label: col.label,
          align: /** @type {const} */ ("center"),
          searchable: false,
          get: (r) => hasPerm(r.mask, col.bit),
          render: (_v, row) =>
            permissionToggleHtml({
              playerId: row.id,
              bit: col.bit,
              on: hasPerm(row.mask, col.bit),
              disabled: !this.objectId,
            }),
        }));

        const table = new DataTable({
          id: "energy-permissions-table",
          embedded: true,
          paramPrefix: PREFIX,
          filterSchema,
          filters,
          selectable: true,
          selectedKeys: this.selectedPlayers,
          searchColumns: [
            { id: "name", label: "Player" },
            { id: "id", label: "Player ID" },
          ],
          toolbarActionsHtml: toolbar,
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
            ...permColumns,
          ],
          rows,
          keyFn: (r) => String(r.id),
          ...parseTableParams(this.params, PREFIX),
          pageSize: 11,
          emptyMessage: hasActiveFilters(filters)
            ? "No players match these filters."
            : "No players in this guild yet.",
        });

        const permsHint =
          perms.status === "missing"
            ? `<p class="sg-permissions__api-hint">Permission grants API is not available on this Guild — toggles still enqueue chain txs.</p>`
            : "";

        return tableSectionCard({
          icon: TABLE_SECTION_ICON,
          title: "Permissions",
          subtitle: `Permissions set for ${subLabel}`,
          bodyHtml: `${picker}${permsHint}${table.renderHTML()}`,
        });
      },
    });

    return `<div class="sg-permissions">${body}</div>`;
  }

  bind() {
    if (!this.container) return;
    const root = this.container;
    const filterSchema = permissionsFilterSchema();
    const params = this.params;

    root.querySelector('[data-action="pick-substation"]')?.addEventListener("change", (e) => {
      const select = /** @type {HTMLSelectElement} */ (e.currentTarget);
      const next = select.value;
      if (!next) return;
      this.selectedPlayers = new Set();
      this.router.goto(`/energy/permissions?substation=${encodeURIComponent(next)}`);
    });

    bindDataTable(
      root.querySelector("#energy-permissions-table"),
      {
        id: "energy-permissions-table",
        paramPrefix: PREFIX,
        filterSchema,
        filters: parseFiltersFromParams(params, PREFIX, filterSchema),
        selectable: true,
        selectedKeys: this.selectedPlayers,
        ...tableBindState(params, PREFIX),
      },
      {
        onChange: (next) =>
          gotoTableState(
            this.router,
            "/energy/permissions",
            { ...params, substation: this.objectId },
            next,
            filterSchema,
            PREFIX,
          ),
        onSelectionChange: (keys) => {
          this.selectedPlayers = keys;
          this.update();
        },
      },
    );

    root.querySelectorAll('[data-action="toggle-perm"]').forEach((el) => {
      el.addEventListener("change", (e) => {
        e.stopPropagation();
        const input = /** @type {HTMLInputElement} */ (e.currentTarget);
        void this._togglePlayerBit(
          input.getAttribute("data-player") ?? "",
          Number(input.getAttribute("data-bit")),
          input.checked,
        );
      });
    });

    root.querySelector('[data-action="set-permissions"]')?.addEventListener("click", () => {
      void this._openSetPermissions();
    });
    root.querySelector('[data-action="bulk-grant-all"]')?.addEventListener("click", () => {
      void this._bulkGrantRevoke(true);
    });
    root.querySelector('[data-action="bulk-revoke-all"]')?.addEventListener("click", () => {
      void this._bulkGrantRevoke(false);
    });
  }

  /**
   * @param {string} playerId
   * @param {number} bit
   * @param {boolean} on
   */
  async _togglePlayerBit(playerId, bit, on) {
    if (!this.objectId || !playerId || !bit) return;
    const creator = this.store.session?.data?.address ?? "";
    const current = this._maskFor(playerId);
    const next = setPerm(current, bit, on);
    void this.permissionManager.enqueueSet(creator, this.objectId, playerId, next);
    notify.toast(on ? "Permission grant enqueued" : "Permission revoke enqueued", "info");
  }

  async _openSetPermissions() {
    if (!this.objectId || !this.selectedPlayers.size) return;
    const mask = await promptSetPermissions({
      playerCount: this.selectedPlayers.size,
      initialMask: ENERGY_PERMISSION_MASK,
    });
    if (mask == null) return;
    const creator = this.store.session?.data?.address ?? "";
    void this.permissionManager.enqueueSetMany(creator, this.objectId, [...this.selectedPlayers], mask);
    notify.toast(`Enqueued permission set for ${this.selectedPlayers.size} player(s)`, "success");
    this.selectedPlayers = new Set();
    this.update();
  }

  /** @param {boolean} grant */
  async _bulkGrantRevoke(grant) {
    if (!this.objectId || !this.selectedPlayers.size) return;
    const ok = await NotificationDialogue.confirm({
      title: grant ? "Grant all permissions?" : "Revoke all permissions?",
      body: `${grant ? "Grant" : "Revoke"} Play, Update, Delete, Grid, Assets, Associations, and Permissions for ${this.selectedPlayers.size} selected player(s).`,
      confirmLabel: grant ? "Grant all" : "Revoke all",
      confirmVariant: grant ? "primary" : "danger",
    });
    if (!ok) return;
    const creator = this.store.session?.data?.address ?? "";
    const ids = [...this.selectedPlayers];
    if (grant) void this.permissionManager.enqueueGrantMany(creator, this.objectId, ids, ENERGY_PERMISSION_MASK);
    else void this.permissionManager.enqueueRevokeMany(creator, this.objectId, ids, ENERGY_PERMISSION_MASK);
    notify.toast(grant ? "Bulk grant enqueued" : "Bulk revoke enqueued", "success");
    this.selectedPlayers = new Set();
    this.update();
  }

  /** @param {string} playerId */
  _maskFor(playerId) {
    if (!this.objectId) return 0;
    const res = this.store.read(keys.objectPermissions(this.objectId));
    const rows = res.status === "success" && Array.isArray(res.data) ? res.data : [];
    return Number(rows.find((r) => String(r.playerId) === String(playerId))?.value ?? 0) || 0;
  }
}

/**
 * @param {import("../store/Resource.js").Resource<unknown>} perms
 * @returns {Map<string, number>}
 */
function permissionMaskMap(perms) {
  /** @type {Map<string, number>} */
  const map = new Map();
  if (perms.status !== "success" || !Array.isArray(perms.data)) return map;
  for (const row of perms.data) {
    map.set(String(row.playerId), Number(row.value) || 0);
  }
  return map;
}

/**
 * @param {{ playerId: string, bit: number, on: boolean, disabled?: boolean }} props
 */
function permissionToggleHtml(props) {
  const id = `perm-${props.playerId}-${props.bit}`;
  return `
    <div class="form-check form-switch sg-perm-switch mb-0 d-inline-flex justify-content-center" onclick="event.stopPropagation()">
      <input class="form-check-input" type="checkbox" role="switch" id="${escapeAttr(id)}"
        data-action="toggle-perm" data-player="${escapeAttr(props.playerId)}" data-bit="${props.bit}"
        ${props.on ? "checked" : ""} ${props.disabled ? "disabled" : ""} />
    </div>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}
