import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { keys } from "../store/keys.js";
import { bindDataTable, gotoTableState, tableBindState } from "../util/bindDataTable.js";
import { parseFiltersFromParams, parseTableParams } from "../util/tableFilters.js";
import { checkboxFilterField, milliwattRangeField } from "../util/tableFilterSchemas.js";
import { statusBadge } from "../util/statusDisplay.js";
import { formatUnitOrDash } from "../util/unitDisplay.js";
import { buildEntityLookup } from "../util/entityLookup.js";
import { renderEntityRef } from "../util/entityLink.js";

const PROVIDERS_PREFIX = "p.";
const AGREEMENTS_PREFIX = "a.";

const PROVIDERS_FILTER_SCHEMA = [
  milliwattRangeField("capacity", "Capacity", (p) => p.capacity),
];

const AGREEMENTS_FILTER_SCHEMA = [
  milliwattRangeField("capacity", "Capacity", (a) => a.capacity),
  checkboxFilterField(
    "active",
    "Active",
    [
      { value: "online", label: "Online" },
      { value: "offline", label: "Offline" },
    ],
    (a) => (a.active ? "online" : "offline"),
  ),
];

/**
 * Energy market agreements and providers visible to this guild.
 */
export class GuildRelationshipsController extends AbstractController {
  constructor(deps) {
    super("GuildRelationships", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.providerManager = deps.providerManager;
    this.agreementManager = deps.agreementManager;
  }

  activate(_page, params) {
    const session = this.store.session?.data;
    if (!session) return;
    void this.providerManager.fetchList();
    void this.agreementManager.fetchByGuild(session.guildId);
    this.layout.mountContent(
      new GuildRelationshipsViewModel({
        store: this.store,
        router: this.router,
        guildId: session.guildId,
        params: params ?? {},
      }),
    );
  }
}

class GuildRelationshipsViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.guildId = deps.guildId;
    this.params = deps.params;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.providerList());
    this.subscribe(this.store, keys.agreementList(this.guildId));
  }

  render() {
    const providers = this.store.read(keys.providerList());
    const agreements = this.store.read(keys.agreementList(this.guildId));
    const lookup = buildEntityLookup(this.store);

    return `
      ${LayoutViewModel.pageHeader({ title: "Energy agreements", subtitle: "Providers and agreements in the energy market." })}
      <div class="row g-3">
        <div class="col-md-6">
          <div class="sg-card">
            <div class="sg-card__title">Providers</div>
            ${ResourceView.render(providers, {
              success: (rows) => renderProviderTable(rows, lookup, this.params),
            })}
          </div>
        </div>
        <div class="col-md-6">
          <div class="sg-card">
            <div class="sg-card__title">Agreements</div>
            ${ResourceView.render(agreements, {
              success: (rows) => renderAgreementTable(rows, lookup, this.params),
            })}
          </div>
        </div>
      </div>
    `;
  }

  bind() {
    this._bindTable("#providers-table", PROVIDERS_PREFIX, PROVIDERS_FILTER_SCHEMA);
    this._bindTable("#agreements-table", AGREEMENTS_PREFIX, AGREEMENTS_FILTER_SCHEMA);
  }

  /** @param {string} selector @param {string} prefix @param {import("../util/tableFilters.js").FilterField[]} filterSchema */
  _bindTable(selector, prefix, filterSchema) {
    const root = this.container?.querySelector(selector);
    if (!root) return;
    bindDataTable(
      root,
      {
        id: selector.slice(1),
        paramPrefix: prefix,
        filterSchema,
        filters: parseFiltersFromParams(this.params, prefix, filterSchema),
        ...tableBindState(this.params, prefix),
      },
      {
        onChange: (next) =>
          gotoTableState(this.router, "/guild/relationships", this.params, next, filterSchema, prefix),
      },
    );
  }
}

/** @param {unknown} rows @param {import("../util/entityLookup.js").EntityLookup} lookup @param {Record<string, string>} params */
function renderProviderTable(rows, lookup, params) {
  const list = /** @type {import("../types/api.js").ProviderData[]} */ (Array.isArray(rows) ? rows : []);
  const filters = parseFiltersFromParams(params, PROVIDERS_PREFIX, PROVIDERS_FILTER_SCHEMA);
  const t = new DataTable({
    id: "providers-table",
    paramPrefix: PROVIDERS_PREFIX,
    filterSchema: PROVIDERS_FILTER_SCHEMA,
    filters,
    embedded: true,
    searchColumns: [
      { id: "id", label: "ID" },
      { id: "owner", label: "Owner" },
    ],
    columns: [
      {
        id: "id",
        label: "ID",
        get: (p) => p.id,
        sort: (a, b) => String(a.id).localeCompare(String(b.id)),
        render: (v) => renderEntityRef(v, lookup),
      },
      {
        id: "owner",
        label: "Owner",
        get: (p) => p.owner_id ?? "—",
        render: (v) => renderEntityRef(v, lookup),
      },
      {
        id: "capacity",
        label: "Capacity",
        get: (p) => formatUnitOrDash(p.capacity, "milliwatt"),
        align: "end",
      },
    ],
    rows: list,
    ...parseTableParams(params, PROVIDERS_PREFIX),
    emptyMessage: "No providers.",
  });
  return t.renderHTML();
}

/** @param {unknown} rows @param {import("../util/entityLookup.js").EntityLookup} lookup @param {Record<string, string>} params */
function renderAgreementTable(rows, lookup, params) {
  const list = /** @type {import("../types/api.js").AgreementData[]} */ (Array.isArray(rows) ? rows : []);
  const filters = parseFiltersFromParams(params, AGREEMENTS_PREFIX, AGREEMENTS_FILTER_SCHEMA);
  const t = new DataTable({
    id: "agreements-table",
    paramPrefix: AGREEMENTS_PREFIX,
    filterSchema: AGREEMENTS_FILTER_SCHEMA,
    filters,
    embedded: true,
    searchColumns: [
      { id: "id", label: "ID" },
      { id: "provider", label: "Provider" },
    ],
    columns: [
      {
        id: "id",
        label: "ID",
        get: (a) => a.id,
        sort: (a, b) => String(a.id).localeCompare(String(b.id)),
        render: (v) => renderEntityRef(v, lookup),
      },
      {
        id: "provider",
        label: "Provider",
        get: (a) => a.provider_id ?? "—",
        render: (v) => renderEntityRef(v, lookup),
      },
      {
        id: "capacity",
        label: "Capacity",
        get: (a) => formatUnitOrDash(a.capacity, "milliwatt"),
        align: "end",
      },
      {
        id: "active",
        label: "Active",
        get: (a) => (a.active ? "Online" : "Offline"),
        render: (v) => statusBadge(String(v)),
      },
    ],
    rows: list,
    ...parseTableParams(params, AGREEMENTS_PREFIX),
    emptyMessage: "No agreements for this guild.",
  });
  return t.renderHTML();
}
