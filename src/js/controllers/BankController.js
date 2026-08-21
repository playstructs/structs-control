import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import {
  overviewCardHeader,
  overviewMetricRow,
} from "../view_models/components/OverviewCard.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { tableSectionCard, TABLE_SECTION_ICON } from "../view_models/components/TableSectionCard.js";
import { pfpAvatar } from "../view_models/components/PfpViewer.js";
import { floatingLabelField } from "../view_models/components/FloatingLabelField.js";
import { notify } from "../store/notify.js";
import { keys } from "../store/keys.js";
import { MSG_TYPES } from "../constants/MessageTypes.js";
import { bindDataTable, gotoTableState, tableBindState } from "../util/bindDataTable.js";
import { parseFiltersFromParams, parseTableParams } from "../util/tableFilters.js";
import { checkboxFilterField, statusFilterField } from "../util/tableFilterSchemas.js";
import { buildEntityLookup } from "../util/entityLookup.js";
import { renderEntityLink } from "../util/entityLink.js";
import { formatUnitOrDash } from "../util/unitDisplay.js";
import { readFormValues, validateForm, required, pattern } from "../util/validate.js";
import { formatActivityRelativeTime } from "../util/activityFeed.js";

const TX_PREFIX = "tx.";
const PLAYER_PREFIX = "pl.";

/**
 * Guild Banks (Figma Flows `2314:76093` / Guild-bank-3) + Mint/Redeem forms.
 */
export class BankController extends AbstractController {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   layout: import("../view_models/LayoutViewModel.js").LayoutViewModel,
   *   bankManager: import("../managers/BankManager.js").BankManager,
   *   guildManager: import("../managers/GuildManager.js").GuildManager,
   *   router: import("../framework/MenuPageRouter.js").MenuPageRouter,
   * }} deps
   */
  constructor(deps) {
    super("Bank", deps.store);
    this.layout = deps.layout;
    this.bankManager = deps.bankManager;
    this.guildManager = deps.guildManager;
    this.router = deps.router;
  }

  activate(page, params) {
    const session = this.store.session?.data;
    if (!session) return;

    void this.bankManager.fetchBalance(session.guildId);
    void this.guildManager.fetchGuild(session.guildId);
    void this.guildManager.fetchRoster(session.guildId);
    void this.guildManager.fetchPowerStats(session.guildId);

    if (page === "mintRedeem") {
      this.layout.mountContent(
        new MintRedeemViewModel({
          store: this.store,
          bankManager: this.bankManager,
          guildId: session.guildId,
          params: params ?? {},
        }),
      );
      return;
    }

    this.layout.mountContent(
      new GuildBanksViewModel({
        store: this.store,
        bankManager: this.bankManager,
        guildId: session.guildId,
        params: params ?? {},
        router: this.router,
      }),
    );
  }
}

class GuildBanksViewModel extends AbstractViewModel {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   bankManager: import("../managers/BankManager.js").BankManager,
   *   guildId: string,
   *   params: Record<string, unknown>,
   *   router: import("../framework/MenuPageRouter.js").MenuPageRouter,
   * }} deps
   */
  constructor(deps) {
    super();
    this.store = deps.store;
    this.bankManager = deps.bankManager;
    this.guildId = deps.guildId;
    this.params = deps.params;
    this.router = deps.router;
    /** @type {Set<string>} */
    this.selectedPlayers = new Set();
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.guild(this.guildId));
    this.subscribe(this.store, keys.guildRoster(this.guildId));
    this.subscribe(this.store, keys.guildPowerStats(this.guildId));
    this.subscribe(this.store, keys.guildBankBalance(this.guildId));
    if (this.store.tx) {
      this._unsubs.push(this.store.tx.subscribe(() => this.update()));
    }
  }

  render() {
    const lookup = buildEntityLookup(this.store);
    const balanceRes = this.store.read(keys.guildBankBalance(this.guildId));
    const powerRes = this.store.read(keys.guildPowerStats(this.guildId));
    const rosterRes = this.store.read(keys.guildRoster(this.guildId));
    const guildRes = this.store.read(keys.guild(this.guildId));
    const guildData = /** @type {import("../types/api.js").GuildData | null} */ (guildRes.data);
    const tokenLabel = guildTokenLabel(guildData);

    const balance = pickBalanceAmount(balanceRes);
    const powerData = /** @type {Record<string, unknown> | null} */ (powerRes.data);
    const collateralFallback = pickAmount(powerData, [
      "total_alpha_infused",
      "alpha_infused",
      "collateral",
      "bank_collateral",
    ]);

    const collateralValue =
      balance != null
        ? formatUnitOrDash(balance.amount, balance.denom || "ualpha")
        : formatUnitOrDash(collateralFallback, "ualpha");

    const collateralCard = `
      <section class="sg-overview-card">
        ${overviewCardHeader({
          title: "Alpha Collateral Balance",
          subtitle: "Your collateral balance compared to other guilds",
        })}
        <div class="sg-overview-card__body">
          ${overviewMetricRow({
            icon: "bi-hourglass-split",
            iconTone: "blue",
            label: "Total Balance",
            columns: [
              { value: collateralValue },
              { period: "Last 7 Days", value: "—" },
              { period: "Last 24hrs", value: "—" },
            ],
          })}
        </div>
      </section>
    `;

    const mintRedeemCard = `
      <section class="sg-overview-card sg-bank-card--actions">
        ${overviewCardHeader({
          title: "Mint & Redeem",
          subtitle: "Mint guild tokens against collateral or redeem them back",
        })}
        <div class="sg-bank-card__actions">
          <a class="sg-btn-metal" href="/guild/mint-redeem?mode=mint" data-spa-link>Mint</a>
          <a class="sg-btn-lunar" href="/guild/mint-redeem?mode=redeem" data-spa-link>Redeem</a>
        </div>
      </section>
    `;

    const ratioCard = `
      <section class="sg-overview-card">
        ${overviewCardHeader({
          title: "Token & Collateral Ratio",
          subtitle: "Your ratio compared to other guilds",
        })}
        <div class="sg-overview-card__body">
          ${overviewMetricRow({
            icon: "bi-bank2",
            iconTone: "blue",
            label: "Total Supply",
            columns: [
              { value: "—" },
              { period: "Last 7 Days", value: "—" },
              { period: "Last 24hrs", value: "—" },
            ],
          })}
          ${overviewMetricRow({
            icon: "bi-hexagon-half",
            iconTone: "blue",
            label: "Ratio",
            columns: [
              { value: "—" },
              { period: "Last 7 Days", value: "—" },
              { period: "Last 24hrs", value: "—" },
            ],
          })}
        </div>
      </section>
    `;

    const asideCard = `
      <section class="sg-overview-card sg-bank-aside">
        ${overviewCardHeader({
          title: "Top Accounts",
          subtitle: "Top accounts with highest balance",
        })}
        <div class="sg-bank-aside__list">
          ${renderEmptyList("Account balances are not available from the Guild API yet.")}
        </div>
        ${overviewCardHeader({
          title: "Top Tokens",
          subtitle: "Most popular tokens",
        })}
        <div class="sg-bank-aside__list">
          ${renderEmptyList("Token popularity rankings are not available yet.")}
        </div>
      </section>
    `;

    const txFilters = parseFiltersFromParams(
      /** @type {Record<string, string | undefined>} */ (this.params),
      TX_PREFIX,
      transactionsFilterSchema(),
    );
    const txRows = bankTxRows(this.store.tx?.list() ?? []);
    const txTable = new DataTable({
      id: "bank-transactions-table",
      embedded: true,
      paramPrefix: TX_PREFIX,
      filterSchema: transactionsFilterSchema(),
      filters: txFilters,
      searchColumns: [
        { id: "player", label: "Player" },
        { id: "counterparty", label: "Counterparty" },
        { id: "action", label: "Action" },
      ],
      columns: [
        {
          id: "date",
          label: "Date",
          get: (r) => r.sortAt,
          sort: (a, b) => Number(a.sortAt) - Number(b.sortAt),
          render: (_v, row) => escapeHtml(row.dateLabel),
        },
        {
          id: "player",
          label: "Player Name",
          get: (r) => r.player,
          sort: (a, b) => String(a.player).localeCompare(String(b.player)),
        },
        {
          id: "counterparty",
          label: "Counterparty",
          get: (r) => r.counterparty,
          sort: (a, b) => String(a.counterparty).localeCompare(String(b.counterparty)),
        },
        {
          id: "amount",
          label: "Amount",
          get: (r) => r.amountSort,
          sort: (a, b) => Number(a.amountSort) - Number(b.amountSort),
          render: (_v, row) => escapeHtml(row.amountLabel),
        },
        {
          id: "action",
          label: "Action",
          get: (r) => r.action,
          sort: (a, b) => String(a.action).localeCompare(String(b.action)),
        },
        {
          id: "direction",
          label: "Direction",
          get: (r) => r.direction,
          sort: (a, b) => String(a.direction).localeCompare(String(b.direction)),
        },
      ],
      rows: txRows,
      keyFn: (r) => String(r.id),
      ...parseTableParams(this.params, TX_PREFIX),
      pageSize: 11,
      emptyMessage: "No token transactions this session.",
      emptyHint: "Mint, redeem, or confiscate to see activity here.",
    });

    const players = Array.isArray(rosterRes.data) ? rosterRes.data : [];
    const playerFilters = parseFiltersFromParams(
      /** @type {Record<string, string | undefined>} */ (this.params),
      PLAYER_PREFIX,
      playerLookupFilterSchema(),
    );
    const selectedCount = this.selectedPlayers.size;
    const bulkDisabled = selectedCount === 0 ? "disabled" : "";
    const playerToolbar = `
      <button type="button" class="sg-btn-danger-outline" data-action="bulk-confiscate" ${bulkDisabled}>
        <i class="bi bi-slash-circle" aria-hidden="true"></i> Confiscate
      </button>
      <a class="sg-btn-success-fill ${selectedCount === 0 ? "is-disabled" : ""}" href="/guild/mint-redeem?mode=transfer" data-spa-link>
        <i class="bi bi-arrow-right" aria-hidden="true"></i> Transfer
      </a>
    `;

    const playerTable = new DataTable({
      id: "bank-player-lookup-table",
      embedded: true,
      paramPrefix: PLAYER_PREFIX,
      filterSchema: playerLookupFilterSchema(),
      filters: playerFilters,
      selectable: true,
      selectedKeys: this.selectedPlayers,
      searchColumns: [
        { id: "name", label: "Players" },
        { id: "id", label: "Player ID" },
      ],
      toolbarActionsHtml: playerToolbar,
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
          id: "token",
          label: "Token",
          get: () => tokenLabel,
          searchable: false,
          render: () => escapeHtml(tokenLabel),
        },
        {
          id: "amount",
          label: "Amount",
          get: () => "",
          searchable: false,
          render: () => "—",
        },
        {
          id: "id",
          label: "Player ID",
          get: (r) => r.id,
          sort: (a, b) => String(a.id).localeCompare(String(b.id)),
        },
        {
          id: "status",
          label: "Status",
          get: () => "Online",
          searchable: false,
          render: () => `<span class="sg-status-dot sg-status-dot--online">Online</span>`,
        },
      ],
      rows: players,
      keyFn: (r) => String(r.id),
      ...parseTableParams(this.params, PLAYER_PREFIX),
      pageSize: 11,
      emptyMessage: "No players in this guild yet.",
      emptyHint: "Try adjusting your search or filters.",
    });

    const balanceHint =
      balanceRes.status === "missing"
        ? `<p class="sg-bank__api-hint">Guild bank balance API is not available on this Guild — collateral and supply metrics stay empty until <code>GET /guild/{id}/bank/balance</code> ships.</p>`
        : "";

    return `
      <div class="sg-bank">
        ${balanceHint}
        <div class="sg-bank__top">
          <div class="sg-bank__main">
            ${collateralCard}
            ${mintRedeemCard}
            ${ratioCard}
          </div>
          <aside class="sg-bank__aside" aria-label="Top accounts and tokens">
            ${asideCard}
          </aside>
        </div>
        <div class="sg-bank__tables">
          ${tableSectionCard({
            icon: TABLE_SECTION_ICON,
            title: "Transactions",
            subtitle: "Token transactions",
            bodyHtml: txTable.renderHTML(),
          })}
          ${tableSectionCard({
            icon: TABLE_SECTION_ICON,
            title: "Player Lookup",
            subtitle: "Players in this guild",
            bodyHtml: playerTable.renderHTML(),
          })}
        </div>
      </div>
    `;
  }

  bind() {
    if (!this.container) return;
    const root = this.container;
    const params = this.params;
    const txSchema = transactionsFilterSchema();
    const playerSchema = playerLookupFilterSchema();

    bindDataTable(
      root.querySelector("#bank-transactions-table"),
      {
        id: "bank-transactions-table",
        paramPrefix: TX_PREFIX,
        filterSchema: txSchema,
        filters: parseFiltersFromParams(/** @type {any} */ (params), TX_PREFIX, txSchema),
        ...tableBindState(params, TX_PREFIX),
      },
      {
        onChange: (next) =>
          gotoTableState(this.router, "/guild/banks", params, next, txSchema, TX_PREFIX),
      },
    );

    bindDataTable(
      root.querySelector("#bank-player-lookup-table"),
      {
        id: "bank-player-lookup-table",
        paramPrefix: PLAYER_PREFIX,
        filterSchema: playerSchema,
        filters: parseFiltersFromParams(/** @type {any} */ (params), PLAYER_PREFIX, playerSchema),
        selectable: true,
        selectedKeys: this.selectedPlayers,
        ...tableBindState(params, PLAYER_PREFIX),
      },
      {
        onChange: (next) =>
          gotoTableState(this.router, "/guild/banks", params, next, playerSchema, PLAYER_PREFIX),
        onSelectionChange: (keysSet) => {
          this.selectedPlayers = keysSet;
          this.update();
        },
      },
    );

    root.querySelector('[data-action="bulk-confiscate"]')?.addEventListener("click", () => {
      if (!this.selectedPlayers.size) return;
      const first = [...this.selectedPlayers][0];
      const roster = this.store.read(keys.guildRoster(this.guildId));
      const players = Array.isArray(roster.data) ? roster.data : [];
      const row = players.find((p) => String(p.id) === String(first));
      const address = row?.primary_address || first;
      this.router.goto(`/guild/mint-redeem?mode=confiscate&player=${encodeURIComponent(String(address))}`);
    });
  }
}

class MintRedeemViewModel extends AbstractViewModel {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   bankManager: import("../managers/BankManager.js").BankManager,
   *   guildId: string,
   *   params: Record<string, unknown>,
   * }} deps
   */
  constructor(deps) {
    super();
    this.store = deps.store;
    this.bankManager = deps.bankManager;
    this.guildId = deps.guildId;
    this.params = deps.params;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.guildBankBalance(this.guildId));
  }

  render() {
    const mode = String(this.params.mode ?? "mint");
    const playerPrefill = String(this.params.player ?? "");
    const balanceRes = this.store.read(keys.guildBankBalance(this.guildId));
    const balance = pickBalanceAmount(balanceRes);
    const available =
      balance != null ? formatUnitOrDash(balance.amount, balance.denom || "ualpha") : "—";

    const mintActive = mode === "mint" || mode === "";
    const redeemActive = mode === "redeem";
    const confiscateActive = mode === "confiscate" || mode === "transfer";

    return `
      <div class="sg-bank-mint">
        <div class="sg-bank-mint__tabs" role="tablist">
          <a class="sg-bank-mint__tab ${mintActive ? "is-active" : ""}" href="/guild/mint-redeem?mode=mint" data-spa-link>Mint</a>
          <a class="sg-bank-mint__tab ${redeemActive ? "is-active" : ""}" href="/guild/mint-redeem?mode=redeem" data-spa-link>Redeem</a>
          <a class="sg-bank-mint__tab ${confiscateActive ? "is-active" : ""}" href="/guild/mint-redeem?mode=confiscate" data-spa-link>Confiscate</a>
        </div>

        <div class="sg-bank-mint__grid">
          <form id="form-mint" class="sg-bank-mint__panel ${mintActive ? "" : "d-none"}">
            <div class="sg-bank-mint__panel-head">
              <h2 class="sg-bank-mint__title">Mint Tokens</h2>
              <p class="sg-bank-mint__subtitle">Lock alpha collateral and mint guild tokens.</p>
            </div>
            ${floatingLabelField({ id: "mint-alpha", name: "amount_alpha", label: "Amount alpha", placeholder: "0" })}
            ${floatingLabelField({ id: "mint-token", name: "amount_token", label: "Amount token", placeholder: "0" })}
            <div class="sg-bank-mint__available">
              <span class="sg-bank-mint__available-label">Available</span>
              <span class="sg-bank-mint__available-value">${escapeHtml(available)}</span>
            </div>
            <button type="submit" class="sg-btn-metal sg-bank-mint__submit" data-action="mint">Mint</button>
          </form>

          <form id="form-redeem" class="sg-bank-mint__panel ${redeemActive ? "" : "d-none"}">
            <div class="sg-bank-mint__panel-head">
              <h2 class="sg-bank-mint__title">Redeem Tokens</h2>
              <p class="sg-bank-mint__subtitle">Burn guild tokens to reclaim collateral.</p>
            </div>
            ${floatingLabelField({ id: "redeem-amount", name: "amount", label: "Amount", placeholder: "0" })}
            ${floatingLabelField({ id: "redeem-denom", name: "denom", label: "Denom", placeholder: "ualpha", value: balance?.denom || "" })}
            <div class="sg-bank-mint__available">
              <span class="sg-bank-mint__available-label">Available</span>
              <span class="sg-bank-mint__available-value">${escapeHtml(available)}</span>
            </div>
            <button type="submit" class="sg-btn-lunar sg-bank-mint__submit" data-action="redeem">Redeem</button>
          </form>

          <form id="form-confiscate" class="sg-bank-mint__panel ${confiscateActive ? "" : "d-none"}">
            <div class="sg-bank-mint__panel-head">
              <h2 class="sg-bank-mint__title">Confiscate &amp; Burn</h2>
              <p class="sg-bank-mint__subtitle">Seize tokens from a player address and burn them.</p>
            </div>
            ${floatingLabelField({
              id: "cb-from",
              name: "from_address",
              label: "From address",
              value: playerPrefill,
            })}
            ${floatingLabelField({ id: "cb-amount", name: "amount_token", label: "Amount token", placeholder: "0" })}
            <button type="submit" class="sg-btn-danger-fill sg-bank-mint__submit" data-action="confiscate">Confiscate &amp; burn</button>
          </form>
        </div>
      </div>
    `;
  }

  bind() {
    if (!this.container) return;
    const container = this.container;
    const amountSchema = { amount: [required(), pattern(/^\d+$/, "Whole numbers only")], denom: [required()] };
    const mintSchema = {
      amount_alpha: [required(), pattern(/^\d+$/, "Whole numbers only")],
      amount_token: [required(), pattern(/^\d+$/, "Whole numbers only")],
    };

    container.querySelector("#form-mint")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = /** @type {HTMLFormElement} */ (container.querySelector("#form-mint"));
      const v = readFormValues(form);
      const { valid, errors } = validateForm(mintSchema, v);
      if (!valid) return notify.formError("form-mint", errors);
      void this.store.tx?.enqueue(
        this.bankManager.buildMint({ amountAlpha: v.amount_alpha, amountToken: v.amount_token }),
      );
      notify.toast("Mint enqueued", "info");
    });

    container.querySelector("#form-redeem")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = /** @type {HTMLFormElement} */ (container.querySelector("#form-redeem"));
      const v = readFormValues(form);
      const { valid, errors } = validateForm(amountSchema, v);
      if (!valid) return notify.formError("form-redeem", errors);
      void this.store.tx?.enqueue(this.bankManager.buildRedeem({ amount: v.amount, denom: v.denom }));
      notify.toast("Redeem enqueued", "info");
    });

    container.querySelector("#form-confiscate")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = /** @type {HTMLFormElement} */ (container.querySelector("#form-confiscate"));
      const v = readFormValues(form);
      const { valid, errors } = validateForm(
        {
          amount_token: [required(), pattern(/^\d+$/, "Whole numbers only")],
          from_address: [required()],
        },
        v,
      );
      if (!valid) return notify.formError("form-confiscate", errors);
      void this.store.tx?.enqueue(
        this.bankManager.buildConfiscateAndBurn({
          fromAddress: v.from_address,
          amountToken: v.amount_token,
        }),
      );
      notify.toast("Confiscate enqueued", "info");
    });
  }
}

function transactionsFilterSchema() {
  return [
    checkboxFilterField("action", "Action", [
      { value: "Minted", label: "Minted" },
      { value: "Redeemed", label: "Redeemed" },
      { value: "Seized", label: "Seized" },
    ], (row) => row.action),
    checkboxFilterField("direction", "Direction", [
      { value: "Credit", label: "Credit" },
      { value: "Debit", label: "Debit" },
    ], (row) => row.direction),
  ];
}

function playerLookupFilterSchema() {
  return [statusFilterField(() => "Online")];
}

/**
 * @param {import("../store/TxQueue.js").TxRecord[]} records
 */
function bankTxRows(records) {
  const bankTypes = new Set([
    MSG_TYPES.GUILD_BANK_MINT,
    MSG_TYPES.GUILD_BANK_REDEEM,
    MSG_TYPES.GUILD_BANK_CONFISCATE_AND_BURN,
  ]);
  return (records ?? [])
    .filter((r) => bankTypes.has(r.typeUrl ?? r.msg?.typeUrl ?? ""))
    .map((record) => {
      const typeUrl = record.typeUrl ?? record.msg?.typeUrl ?? "";
      const value = /** @type {Record<string, unknown>} */ (record.msg?.value ?? {});
      const action =
        typeUrl === MSG_TYPES.GUILD_BANK_MINT
          ? "Minted"
          : typeUrl === MSG_TYPES.GUILD_BANK_REDEEM
            ? "Redeemed"
            : "Seized";
      const direction = action === "Redeemed" || action === "Seized" ? "Debit" : "Credit";
      const amountRaw =
        value.amountToken ??
        value.amount_token ??
        (value.amountToken && typeof value.amountToken === "object"
          ? /** @type {{ amount?: string }} */ (value.amountToken).amount
          : null) ??
        value.amountAlpha ??
        value.amount_alpha ??
        "";
      const amountNum = Number(amountRaw) || 0;
      return {
        id: record.id,
        sortAt: record.updatedAt,
        dateLabel: formatBankDate(record.updatedAt),
        player: String(value.creator ?? "—"),
        counterparty: String(value.address ?? value.fromAddress ?? "—"),
        amountSort: amountNum,
        amountLabel: amountRaw === "" || amountRaw == null ? "—" : String(amountRaw),
        action,
        direction,
        relative: formatActivityRelativeTime(record.updatedAt),
      };
    })
    .sort((a, b) => b.sortAt - a.sortAt);
}

/** @param {number} ts */
function formatBankDate(ts) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * @param {import("../store/Resource.js").Resource<unknown>} res
 * @returns {{ amount: string | number, denom: string } | null}
 */
function pickBalanceAmount(res) {
  if (res.status !== "success" || !res.data) return null;
  const data = /** @type {any} */ (res.data);
  const balances = Array.isArray(data?.balances) ? data.balances : Array.isArray(data) ? data : null;
  if (!balances?.length) {
    if (data?.amount != null) return { amount: data.amount, denom: String(data.denom ?? "ualpha") };
    return null;
  }
  const first = balances[0];
  return { amount: first.amount ?? 0, denom: String(first.denom ?? "ualpha") };
}

/**
 * @param {Record<string, unknown> | null} data
 * @param {string[]} keysList
 */
function pickAmount(data, keysList) {
  if (!data) return null;
  for (const key of keysList) {
    if (data[key] != null && data[key] !== "") return data[key];
  }
  return null;
}

/** @param {import("../types/api.js").GuildData | null} guild */
function guildTokenLabel(guild) {
  const tag = guild?.tag || guild?.name;
  return tag ? String(tag) : "guild token";
}

/** @param {string} hint */
function renderEmptyList(hint) {
  return `<p class="sg-bank-aside__empty">${escapeHtml(hint)}</p>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
