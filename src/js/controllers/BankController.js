import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import {
  overviewCardHeader,
  overviewMetricRow,
} from "../view_models/components/OverviewCard.js";
import { DataTable } from "../view_models/components/DataTable.js";
import { tableSectionCard, TABLE_SECTION_ICON } from "../view_models/components/TableSectionCard.js";
import { pfpAvatar } from "../view_models/components/PfpViewer.js";
import { notify } from "../store/notify.js";
import { keys } from "../store/keys.js";
import { MSG_TYPES } from "../constants/MessageTypes.js";
import { bindDataTable, gotoTableState, tableBindState } from "../util/bindDataTable.js";
import { parseFiltersFromParams, parseTableParams } from "../util/tableFilters.js";
import { checkboxFilterField, statusFilterField } from "../util/tableFilterSchemas.js";
import { buildEntityLookup } from "../util/entityLookup.js";
import { renderEntityLink } from "../util/entityLink.js";
import { formatUnitOrDash } from "../util/unitDisplay.js";
import { formatActivityRelativeTime } from "../util/activityFeed.js";
import { openMintRedeemDialogue, openConfiscateDialogue } from "../framework/MintRedeemDialogue.js";
import { TX_STATUS } from "../constants/SigningQueueConstants.js";
import {
  beginMintFlowWatch,
  captureEnqueuedTx,
  dismissMintSuccessAlert,
  markMintCompletedVisited,
  maybeToastMintSuccess,
  mintCompletedPath,
  mintProcessingPath,
  readMintFlow,
  syncMintFlowSettled,
  shouldShowMintSuccessAlert,
} from "../util/mintFlow.js";

const TX_PREFIX = "tx.";
const PLAYER_PREFIX = "pl.";

/**
 * Guild Banks (Figma Flows `2314:76093`) + Mint/Redeem modals (`2314:77251`)
 * + mint processing/completed (`2314:77254` / `2314:77387`).
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
    void this.bankManager.fetchAllBanks();
    void this.bankManager.fetchHistory(session.guildId, "1d");
    void this.bankManager.fetchHistory(session.guildId, "1h");
    void this.bankManager.fetchGuildLeaderboard();
    void this.guildManager.fetchGuild(session.guildId);
    void this.guildManager.fetchRoster(session.guildId);
    void this.guildManager.fetchPowerStats(session.guildId);

    if (page === "mintProcessing" || page === "redeemProcessing") {
      this.layout.mountContent(
        new MintStatusViewModel({
          store: this.store,
          router: this.router,
          phase: "processing",
          mode: page === "redeemProcessing" ? "redeem" : "mint",
        }),
      );
      return;
    }
    if (page === "mintCompleted" || page === "redeemCompleted") {
      this.layout.mountContent(
        new MintStatusViewModel({
          store: this.store,
          router: this.router,
          phase: "completed",
          mode: page === "redeemCompleted" ? "redeem" : "mint",
        }),
      );
      return;
    }

    // Legacy `/guild/mint-redeem` → stay on Guild Banks and open the modal.
    const mergedParams = { ...(params ?? {}) };
    if (page === "mintRedeem" && !mergedParams.mode) {
      mergedParams.mode = "mint";
    }

    this.layout.mountContent(
      new GuildBanksViewModel({
        store: this.store,
        bankManager: this.bankManager,
        guildId: session.guildId,
        params: mergedParams,
        router: this.router,
        openMode: page === "mintRedeem" ? String(mergedParams.mode ?? "mint") : String(mergedParams.mode ?? ""),
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
   *   openMode?: string,
   * }} deps
   */
  constructor(deps) {
    super();
    this.store = deps.store;
    this.bankManager = deps.bankManager;
    this.guildId = deps.guildId;
    this.params = deps.params;
    this.router = deps.router;
    this.openMode = deps.openMode ?? "";
    /** @type {Set<string>} */
    this.selectedPlayers = new Set();
    /** @type {boolean} */
    this._openedFromQuery = false;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.guild(this.guildId));
    this.subscribe(this.store, keys.guildRoster(this.guildId));
    this.subscribe(this.store, keys.guildPowerStats(this.guildId));
    this.subscribe(this.store, keys.guildBankBalance(this.guildId));
    this.subscribe(this.store, keys.guildBankAll());
    this.subscribe(this.store, keys.guildBankHistory(this.guildId, "1d"));
    this.subscribe(this.store, keys.guildBankHistory(this.guildId, "1h"));
    this.subscribe(this.store, keys.leaderboard("guild"));
    const bank = bankRow(this.store.read(keys.guildBankBalance(this.guildId)));
    const denom = bank?.denom;
    if (denom) {
      void this.bankManager.fetchTopAccounts(denom);
      this.subscribe(this.store, keys.inventoryByDenom(denom, 1));
    }
    if (this.store.tx) {
      this._unsubs.push(
        this.store.tx.subscribe(() => {
          syncMintFlowSettled(this.store);
          maybeToastMintSuccess(this.router, this.store);
          this.update();
        }),
      );
    }
    syncMintFlowSettled(this.store);
    maybeToastMintSuccess(this.router, this.store);
    if (shouldShowMintSuccessAlert()) this.update();
  }

  render() {
    syncMintFlowSettled(this.store);
    const lookup = buildEntityLookup(this.store);
    const balanceRes = this.store.read(keys.guildBankBalance(this.guildId));
    const banksAllRes = this.store.read(keys.guildBankAll());
    const historyRes = this.store.read(keys.guildBankHistory(this.guildId, "1d"));
    const leaderboardRes = this.store.read(keys.leaderboard("guild"));
    const powerRes = this.store.read(keys.guildPowerStats(this.guildId));
    const rosterRes = this.store.read(keys.guildRoster(this.guildId));
    const guildRes = this.store.read(keys.guild(this.guildId));
    const guildData = /** @type {import("../types/api.js").GuildData | null} */ (guildRes.data);
    const tokenLabel = guildTokenLabel(guildData);

    const bank = bankRow(balanceRes);
    const denom = bank?.denom || guildTokenDenom(this.guildId);
    const inventoryRes = denom ? this.store.read(keys.inventoryByDenom(denom, 1)) : null;
    if (denom && (!inventoryRes || inventoryRes.status === "idle")) {
      void this.bankManager.fetchTopAccounts(denom);
    }

    const powerData = /** @type {Record<string, unknown> | null} */ (powerRes.data);
    const collateralRaw =
      bank?.collateral ??
      pickAmount(powerData, ["total_alpha_infused", "alpha_infused", "collateral", "bank_collateral"]);
    const supplyRaw = bank?.supply ?? null;
    const ratioRaw = bank?.ratio ?? null;

    const collateralValue = formatUnitOrDash(collateralRaw, "ualpha");
    const supplyValue =
      supplyRaw != null && supplyRaw !== "" ? formatUnitOrDash(supplyRaw, denom || "uguild") : "—";
    const ratioValue =
      ratioRaw != null && ratioRaw !== "" && Number.isFinite(Number(ratioRaw))
        ? Number(ratioRaw).toFixed(2)
        : "—";
    const collateralRank = rankLabel(leaderboardRes, this.guildId);
    const history1hRes = this.store.read(keys.guildBankHistory(this.guildId, "1h"));
    const mint24h = historyMintVolume(history1hRes.status !== "idle" ? history1hRes : historyRes, denom);
    const balanceByOwner = inventoryBalanceMap(inventoryRes);

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
              {
                value: collateralValue,
                rank: collateralRank || undefined,
                rankTone: "neutral",
              },
              { period: "Last 7 Days", value: "—" },
              { period: "Last 24hrs", value: mint24h.collateralHint },
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
          <button type="button" class="sg-btn-metal" data-action="open-mint">Mint</button>
          <button type="button" class="sg-btn-lunar" data-action="open-redeem">Redeem</button>
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
              { value: supplyValue },
              { period: "Last 7 Days", value: "—" },
              { period: "Last 24hrs", value: mint24h.supplyHint },
            ],
          })}
          ${overviewMetricRow({
            icon: "bi-hexagon-half",
            iconTone: "blue",
            label: "Ratio",
            columns: [
              { value: ratioValue },
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
          ${renderTopAccounts(inventoryRes, lookup, denom)}
        </div>
        ${overviewCardHeader({
          title: "Top Tokens",
          subtitle: "Most popular tokens",
        })}
        <div class="sg-bank-aside__list">
          ${renderTopTokens(banksAllRes, lookup)}
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
      <button type="button" class="sg-btn-success-fill" data-action="bulk-transfer" ${bulkDisabled}>
        <i class="bi bi-arrow-right" aria-hidden="true"></i> Transfer
      </button>
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
          get: (r) => balanceByOwner.get(`player:${String(r.id)}`) ?? "",
          searchable: false,
          sort: (a, b) => {
            const av = Number(balanceByOwner.get(`player:${String(a.id)}`) ?? 0);
            const bv = Number(balanceByOwner.get(`player:${String(b.id)}`) ?? 0);
            return av - bv;
          },
          render: (_v, row) => {
            const raw = balanceByOwner.get(`player:${String(row.id)}`);
            return raw != null ? escapeHtml(formatUnitOrDash(raw, denom || "uguild")) : "—";
          },
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
        ? `<p class="sg-bank__api-hint">Guild bank API (<code>GET /guild-bank</code>) is not available on this Guild.</p>`
        : "";

    const flow = readMintFlow();
    const showSuccess = shouldShowMintSuccessAlert();
    const successCopy =
      flow?.mode === "redeem"
        ? "Recent redemption has completed. Check it out "
        : "Recent minting has completed. Check it out ";
    const successAlert = showSuccess
      ? `
      <div class="sg-bank__success-alert" role="status">
        <span class="sg-bank__success-alert-icon" aria-hidden="true"><i class="bi bi-check-circle-fill"></i></span>
        <p class="sg-bank__success-alert-body">
          ${successCopy}<button type="button" class="sg-bank__success-alert-link" data-action="mint-success-details">here</button>
        </p>
        <button type="button" class="sg-bank__success-alert-close" data-action="dismiss-mint-success" aria-label="Dismiss">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </div>`
      : "";

    return `
      <div class="sg-bank">
        ${balanceHint}
        ${successAlert}
        <div class="sg-bank__primary">
          <div class="sg-bank__main">
            ${collateralCard}
            ${mintRedeemCard}
            ${ratioCard}
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
        <aside class="sg-bank__aside" aria-label="Top accounts and tokens">
          ${asideCard}
        </aside>
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

    root.querySelector('[data-action="open-mint"]')?.addEventListener("click", () => {
      void this.openFlow("mint");
    });
    root.querySelector('[data-action="open-redeem"]')?.addEventListener("click", () => {
      void this.openFlow("redeem");
    });
    root.querySelector('[data-action="dismiss-mint-success"]')?.addEventListener("click", () => {
      dismissMintSuccessAlert();
      this.update();
    });
    root.querySelector('[data-action="mint-success-details"]')?.addEventListener("click", () => {
      const flow = readMintFlow();
      const mode = flow?.mode === "redeem" ? "redeem" : "mint";
      dismissMintSuccessAlert();
      this.router.goto(mintCompletedPath(mode));
    });
    root.querySelector('[data-action="bulk-transfer"]')?.addEventListener("click", () => {
      if (!this.selectedPlayers.size) return;
      notify.toast("Token transfer is not available yet.", "info");
    });
    root.querySelector('[data-action="bulk-confiscate"]')?.addEventListener("click", () => {
      if (!this.selectedPlayers.size) return;
      const first = [...this.selectedPlayers][0];
      const roster = this.store.read(keys.guildRoster(this.guildId));
      const players = Array.isArray(roster.data) ? roster.data : [];
      const row = players.find((p) => String(p.id) === String(first));
      const address = row?.primary_address || first;
      void this.openConfiscate(String(address ?? ""));
    });

    if (!this._openedFromQuery && (this.openMode === "mint" || this.openMode === "redeem")) {
      this._openedFromQuery = true;
      void this.openFlow(/** @type {"mint" | "redeem"} */ (this.openMode));
    } else if (!this._openedFromQuery && (this.openMode === "confiscate" || this.openMode === "transfer")) {
      this._openedFromQuery = true;
      void this.openConfiscate(String(this.params.player ?? ""));
    }
  }

  /**
   * @param {"mint" | "redeem"} mode
   */
  async openFlow(mode) {
    const guildRes = this.store.read(keys.guild(this.guildId));
    const balanceRes = this.store.read(keys.guildBankBalance(this.guildId));
    const powerRes = this.store.read(keys.guildPowerStats(this.guildId));
    const bank = bankRow(balanceRes);
    const powerData = /** @type {Record<string, unknown> | null} */ (powerRes.data);

    const collateralRaw =
      bank?.collateral ??
      pickAmount(powerData, ["total_alpha_infused", "alpha_infused", "collateral", "bank_collateral"]);
    const supplyRaw = bank?.supply ?? null;
    const denom = bank?.denom || guildTokenDenom(this.guildId);

    const tokenLabel = guildTokenLabel(/** @type {import("../types/api.js").GuildData | null} */ (guildRes.data));
    const result = await openMintRedeemDialogue({
      mode,
      tokenLabel,
      denom,
      collateralBalance: collateralRaw != null ? Number(collateralRaw) : null,
      totalSupply: supplyRaw != null ? Number(supplyRaw) : null,
    });
    if (!result) return;

    const preview = result.preview;
    const guildName =
      String(/** @type {Record<string, unknown> | null} */ (guildRes.data)?.name ?? "") ||
      String(/** @type {Record<string, unknown> | null} */ (guildRes.data)?.id ?? this.guildId);
    const invalidate = this.bankManager.invalidateKeys(this.guildId, denom);

    if (result.mode === "redeem") {
      const enqueued = await captureEnqueuedTx(() =>
        this.store.tx?.enqueue(this.bankManager.buildRedeem({ amount: result.amount, denom: result.denom }), {
          invalidate,
        }),
      );
      if (!enqueued?.id || !this.store.tx) {
        notify.toast("Could not enqueue redeem", "danger");
        return;
      }
      beginMintFlowWatch({
        txId: enqueued.id,
        store: this.store,
        router: this.router,
        state: {
          mode: "redeem",
          amountToken: result.amount,
          amountAlpha: String(preview.alphaReceivingRaw ?? ""),
          denom: result.denom,
          tokenLabel,
          guildName,
          alphaReceiving: preview.alphaReceiving ?? null,
          prevCollateral: preview.prevCollateral,
          nextCollateral: preview.nextCollateral,
          deltaCollateral: preview.deltaCollateral?.text ?? null,
          deltaCollateralTone: preview.deltaCollateral?.tone ?? null,
          prevSupply: preview.prevSupply,
          nextSupply: preview.nextSupply,
          deltaSupply: preview.deltaSupply?.text ?? null,
          deltaSupplyTone: preview.deltaSupply?.tone ?? null,
          prevRatio: preview.prevRatio,
          nextRatio: preview.nextRatio,
          deltaRatio: preview.deltaRatio?.text ?? null,
          deltaRatioTone: preview.deltaRatio?.tone ?? null,
        },
      });
      this.router.goto(mintProcessingPath("redeem"));
      return;
    }

    const enqueued = await captureEnqueuedTx(() =>
      this.store.tx?.enqueue(
        this.bankManager.buildMint({ amountAlpha: result.amountAlpha, amountToken: result.amountToken }),
        { invalidate },
      ),
    );
    if (!enqueued?.id || !this.store.tx) {
      notify.toast("Could not enqueue mint", "danger");
      return;
    }

    beginMintFlowWatch({
      txId: enqueued.id,
      store: this.store,
      router: this.router,
      state: {
        mode: "mint",
        amountToken: result.amountToken,
        amountAlpha: result.amountAlpha,
        tokenLabel,
        guildName,
        alphaReceiving: null,
        prevCollateral: preview.prevCollateral,
        nextCollateral: preview.nextCollateral,
        deltaCollateral: preview.deltaCollateral?.text ?? null,
        deltaCollateralTone: preview.deltaCollateral?.tone ?? null,
        prevSupply: preview.prevSupply,
        nextSupply: preview.nextSupply,
        deltaSupply: preview.deltaSupply?.text ?? null,
        deltaSupplyTone: preview.deltaSupply?.tone ?? null,
        prevRatio: preview.prevRatio,
        nextRatio: preview.nextRatio,
        deltaRatio: preview.deltaRatio?.text ?? null,
        deltaRatioTone: preview.deltaRatio?.tone ?? null,
      },
    });
    this.router.goto(mintProcessingPath("mint"));
  }

  /** @param {string} playerPrefill */
  async openConfiscate(playerPrefill) {
    const guildRes = this.store.read(keys.guild(this.guildId));
    const tokenLabel = guildTokenLabel(/** @type {import("../types/api.js").GuildData | null} */ (guildRes.data));
    const result = await openConfiscateDialogue({ playerPrefill, tokenLabel });
    if (!result) return;
    const bank = bankRow(this.store.read(keys.guildBankBalance(this.guildId)));
    void this.store.tx?.enqueue(
      this.bankManager.buildConfiscateAndBurn({
        fromAddress: result.fromAddress,
        amountToken: result.amountToken,
      }),
      { invalidate: this.bankManager.invalidateKeys(this.guildId, bank?.denom) },
    );
    notify.toast("Confiscate enqueued", "info");
  }
}

/**
 * Figma Token Minting / Redemption Processing & Completed.
 */
class MintStatusViewModel extends AbstractViewModel {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   router: import("../framework/MenuPageRouter.js").MenuPageRouter,
   *   phase: "processing" | "completed",
   *   mode?: "mint" | "redeem",
   * }} deps
   */
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.phase = deps.phase;
    this.mode = deps.mode === "redeem" ? "redeem" : "mint";
  }

  mount(container) {
    super.mount(container);
    if (this.store.tx) {
      this._unsubs.push(
        this.store.tx.subscribe(() => {
          syncMintFlowSettled(this.store);
          maybeToastMintSuccess(this.router, this.store);
          this.update();
        }),
      );
    }
    if (this.phase === "completed") {
      markMintCompletedVisited();
    }
    syncMintFlowSettled(this.store);
    maybeToastMintSuccess(this.router, this.store);
  }

  render() {
    const flow = readMintFlow();
    const mode = flow?.mode === "redeem" || this.mode === "redeem" ? "redeem" : "mint";
    const tx = flow?.txId ? this.store.tx?.list()?.find((r) => r.id === flow.txId) : null;
    const confirmed = tx?.status === TX_STATUS.CONFIRMED || this.phase === "completed" || Boolean(flow?.settled);
    const failed = tx?.status === TX_STATUS.FAILED || tx?.status === TX_STATUS.CANCELLED;
    const processing = this.phase === "processing" && !confirmed && !failed;

    const amountLabel = escapeHtml(flow?.amountToken || "—");
    const tokenName = escapeHtml(flow?.tokenLabel || "guild tokens");

    const title = confirmed
      ? mode === "redeem"
        ? "Token Redemption Completed"
        : "Token Minting Completed"
      : failed
        ? mode === "redeem"
          ? "Token Redemption Failed"
          : "Token Minting Failed"
        : mode === "redeem"
          ? "Token Redemption Processing"
          : "Token Minting Processing";

    const subtitle = confirmed
      ? mode === "redeem"
        ? "Your token redemption process has completed!"
        : "Your token minting process has completed!"
      : failed
        ? tx?.error || (mode === "redeem" ? "The redeem transaction did not complete." : "The mint transaction did not complete.")
        : mode === "redeem"
          ? `We’re processing your redemption of <strong>${amountLabel} ${tokenName}</strong>`
          : "We’re processing your token minting request";

    const icon = confirmed
      ? "bi-patch-check-fill sg-mint-status__icon--ok"
      : failed
        ? "bi-x-circle-fill sg-mint-status__icon--err"
        : "bi-clock-fill sg-mint-status__icon--wait";

    const pendingLabel = confirmed ? "New" : "Pending";
    const summaryBody =
      mode === "redeem"
        ? renderRedeemSummaryTable(flow, pendingLabel)
        : renderMintSummaryTable(flow, pendingLabel);

    const nextDisabled = processing ? "disabled" : "";
    const nextAction =
      this.phase === "completed" || failed ? "goto-banks" : confirmed ? "goto-completed" : "goto-banks";

    return `
      <div class="sg-mint-status">
        <a class="sg-mint-status__back" href="/guild/banks" data-spa-link data-action="back-banks">
          <i class="bi bi-arrow-left" aria-hidden="true"></i> back to Guild Banks
        </a>
        <div class="sg-mint-status__hero">
          <span class="sg-mint-status__icon" aria-hidden="true"><i class="bi ${icon}"></i></span>
          <h1 class="sg-mint-status__title">${escapeHtml(title)}</h1>
          <p class="sg-mint-status__subtitle">${subtitle}</p>
        </div>
        ${tableSectionCard({
          icon: "bi-arrow-repeat",
          title: "Token Summary",
          subtitle: "Changes in Token Balance",
          bodyHtml: summaryBody,
        })}
        <div class="sg-mint-status__actions">
          <button type="button" class="sg-btn-success-fill" data-action="${nextAction}" ${nextDisabled}>Next</button>
        </div>
      </div>
    `;
  }

  bind() {
    if (!this.container) return;
    const mode = readMintFlow()?.mode === "redeem" || this.mode === "redeem" ? "redeem" : "mint";

    this.container.querySelector('[data-action="goto-completed"]')?.addEventListener("click", () => {
      this.router.goto(mintCompletedPath(mode));
    });
    this.container.querySelector('[data-action="goto-banks"]')?.addEventListener("click", () => {
      this.router.goto("/guild/banks");
    });
  }
}

/**
 * @param {import("../util/mintFlow.js").MintFlowState | null} flow
 * @param {string} nextHeaderPrefix
 */
function renderMintSummaryTable(flow, nextHeaderPrefix) {
  const cell = (label, value, delta, tone) => {
    const deltaHtml =
      delta && tone
        ? ` <span class="sg-mint-modal__delta sg-mint-modal__delta--${tone}">${escapeHtml(delta)}</span>`
        : delta
          ? ` <span class="sg-mint-modal__delta">${escapeHtml(delta)}</span>`
          : "";
    return `
      <div class="sg-mint-summary__col">
        <div class="sg-mint-summary__head">${escapeHtml(label)}</div>
        <div class="sg-mint-summary__val">${escapeHtml(value ?? "—")}${deltaHtml}</div>
      </div>`;
  };

  return `
    <div class="sg-mint-summary">
      ${cell("Previous Alpha Balance", flow?.prevCollateral, null, null)}
      ${cell(`${nextHeaderPrefix} Alpha Balance`, flow?.nextCollateral, flow?.deltaCollateral ?? null, flow?.deltaCollateralTone ?? null)}
      ${cell("Previous Supply", flow?.prevSupply, null, null)}
      ${cell(`${nextHeaderPrefix} Supply`, flow?.nextSupply, flow?.deltaSupply ?? null, flow?.deltaSupplyTone ?? null)}
      ${cell("Previous Collateral Ratio", flow?.prevRatio, null, null)}
      ${cell(`${nextHeaderPrefix} Collateral Ratio`, flow?.nextRatio, flow?.deltaRatio ?? null, flow?.deltaRatioTone ?? null)}
    </div>`;
}

/**
 * Redeem processing/completed columns (Figma `2314:78201`).
 *
 * @param {import("../util/mintFlow.js").MintFlowState | null} flow
 * @param {string} nextHeaderPrefix
 */
function renderRedeemSummaryTable(flow, nextHeaderPrefix) {
  const cell = (label, value, delta, tone) => {
    const deltaHtml =
      delta && tone
        ? ` <span class="sg-mint-modal__delta sg-mint-modal__delta--${tone}">${escapeHtml(delta)}</span>`
        : delta
          ? ` <span class="sg-mint-modal__delta">${escapeHtml(delta)}</span>`
          : "";
    return `
      <div class="sg-mint-summary__col">
        <div class="sg-mint-summary__head">${escapeHtml(label)}</div>
        <div class="sg-mint-summary__val">${escapeHtml(value ?? "—")}${deltaHtml}</div>
      </div>`;
  };

  const pendingAmount = nextHeaderPrefix === "New" ? "Amount Redeemed" : "Pending Amount Redeemed";
  const pendingSupply = nextHeaderPrefix === "New" ? "New Supply" : "Pending Supply";
  const pendingAlpha = nextHeaderPrefix === "New" ? "Alpha Received" : "Pending Alpha Received";
  const pendingCollateral =
    nextHeaderPrefix === "New" ? "New Alpha Collateral Balance" : "Pending Alpha Collateral Balance";

  return `
    <div class="sg-mint-summary">
      ${cell("Guild", flow?.guildName || "—", null, null)}
      ${cell(pendingAmount, flow?.amountToken, null, null)}
      ${cell("Previous Supply", flow?.prevSupply, null, null)}
      ${cell(pendingSupply, flow?.nextSupply, flow?.deltaSupply ?? null, flow?.deltaSupplyTone ?? null)}
      ${cell(pendingAlpha, flow?.alphaReceiving || "—", null, null)}
      ${cell("Previous Alpha Collateral Balance", flow?.prevCollateral, null, null)}
      ${cell(pendingCollateral, flow?.nextCollateral, flow?.deltaCollateral ?? null, flow?.deltaCollateralTone ?? null)}
    </div>`;
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
 * Normalized guild-bank row from `BankManager.fetchBalance`.
 * @param {import("../store/Resource.js").Resource<unknown>} res
 * @returns {{
 *   guild_id: string,
 *   denom: string,
 *   collateral: unknown,
 *   supply: unknown,
 *   ratio: unknown,
 * } | null}
 */
function bankRow(res) {
  if (res.status !== "success" || !res.data || typeof res.data !== "object") return null;
  const data = /** @type {Record<string, unknown>} */ (res.data);
  return {
    guild_id: String(data.guild_id ?? ""),
    denom: String(data.denom ?? ""),
    collateral: data.collateral ?? data.amount ?? data.bank_collateral ?? null,
    supply: data.supply ?? data.total_supply ?? data.token_supply ?? null,
    ratio: data.ratio ?? null,
  };
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

/** @param {string} guildId */
function guildTokenDenom(guildId) {
  return guildId ? `uguild.${guildId}` : "uguild";
}

/** @param {import("../types/api.js").GuildData | null} guild */
function guildTokenLabel(guild) {
  const tag = guild?.tag || guild?.name;
  return tag ? String(tag) : "guild token";
}

/**
 * Cross-guild collateral rank from `/leaderboard/guild`.
 * @param {import("../store/Resource.js").Resource<unknown>} res
 * @param {string} guildId
 */
function rankLabel(res, guildId) {
  if (res.status !== "success" || !Array.isArray(res.data)) return "";
  const idx = res.data.findIndex((row) => String(/** @type {Record<string, unknown>} */ (row).guild_id) === String(guildId));
  if (idx < 0) return "";
  return `#${idx + 1}`;
}

/**
 * Net ledger volume over the last ~24h from `/guild-bank/{id}/history?bucket=1h`.
 * @param {import("../store/Resource.js").Resource<unknown>} res
 * @param {string} denom
 */
function historyMintVolume(res, denom) {
  const empty = { collateralHint: "—", supplyHint: "—" };
  if (res.status !== "success" || !Array.isArray(res.data)) return empty;

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let collateralNet = 0;
  let supplyNet = 0;
  let sawCollateral = false;
  let sawSupply = false;

  for (const raw of res.data) {
    const row = /** @type {Record<string, unknown>} */ (raw);
    const t = Date.parse(String(row.bucket ?? ""));
    if (!Number.isFinite(t) || t < cutoff) continue;
    const vol = Number(row.volume);
    if (!Number.isFinite(vol)) continue;
    const action = String(row.action ?? "");
    if (action === "infused" || action === "defusion_completed") {
      collateralNet += vol;
      sawCollateral = true;
    } else if (action === "minted" || action === "burned") {
      supplyNet += vol;
      sawSupply = true;
    }
  }

  return {
    collateralHint: sawCollateral ? formatSignedUnit(collateralNet, "ualpha") : "—",
    supplyHint: sawSupply ? formatSignedUnit(supplyNet, denom || "uguild") : "—",
  };
}

/**
 * @param {number} net
 * @param {string} denom
 */
function formatSignedUnit(net, denom) {
  const abs = formatUnitOrDash(Math.abs(net), denom);
  if (abs === "—") return "—";
  if (net > 0) return `+${abs}`;
  if (net < 0) return `−${abs}`;
  return abs;
}

/**
 * @param {import("../store/Resource.js").Resource<unknown> | null} res
 * @returns {Map<string, string>}
 */
function inventoryBalanceMap(res) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!res || res.status !== "success" || !Array.isArray(res.data)) return map;
  for (const raw of res.data) {
    const row = /** @type {Record<string, unknown>} */ (raw);
    const ownerType = String(row.owner_type ?? "");
    const ownerId = String(row.owner_id ?? "");
    if (!ownerType || !ownerId) continue;
    map.set(`${ownerType}:${ownerId}`, String(row.balance ?? ""));
  }
  return map;
}

/**
 * @param {import("../store/Resource.js").Resource<unknown> | null} res
 * @param {ReturnType<typeof buildEntityLookup>} lookup
 * @param {string} denom
 */
function renderTopAccounts(res, lookup, denom) {
  if (!res || res.status === "idle" || res.status === "loading") {
    return renderEmptyList("Loading top accounts…");
  }
  if (res.status === "missing") {
    return renderEmptyList("Inventory API not available on this Guild.");
  }
  if (res.status === "error") {
    return renderEmptyList("Could not load top accounts.");
  }
  const rows = Array.isArray(res.data) ? res.data : [];
  const players = rows
    .filter((r) => String(/** @type {Record<string, unknown>} */ (r).owner_type) === "player")
    .slice(0, 8);
  if (!players.length) return renderEmptyList("No token holders yet.");

  return players
    .map((raw) => {
      const row = /** @type {Record<string, unknown>} */ (raw);
      const ownerId = String(row.owner_id ?? "");
      const balance = formatUnitOrDash(row.balance, denom || "uguild");
      return `
        <div class="sg-bank-aside__row">
          <div class="sg-bank-aside__row-left">
            ${pfpAvatar({ attributes: null, size: "sm" })}
            <p class="sg-bank-aside__row-name">${renderEntityLink(ownerId, lookup)}</p>
          </div>
          <p class="sg-bank-aside__row-value">${escapeHtml(balance)}</p>
        </div>
      `;
    })
    .join("");
}

/**
 * Network guild banks ranked by collateral (Top Tokens card).
 * @param {import("../store/Resource.js").Resource<unknown>} res
 * @param {ReturnType<typeof buildEntityLookup>} lookup
 */
function renderTopTokens(res, lookup) {
  if (res.status === "idle" || res.status === "loading") {
    return renderEmptyList("Loading top tokens…");
  }
  if (res.status === "missing") {
    return renderEmptyList("Guild bank API not available on this Guild.");
  }
  if (res.status === "error") {
    return renderEmptyList("Could not load top tokens.");
  }
  const rows = Array.isArray(res.data) ? [...res.data] : [];
  const tokenRows = rows
    .filter((r) => String(/** @type {Record<string, unknown>} */ (r).denom ?? "").startsWith("uguild."))
    .sort((a, b) => {
      const ac = Number(/** @type {Record<string, unknown>} */ (a).collateral) || 0;
      const bc = Number(/** @type {Record<string, unknown>} */ (b).collateral) || 0;
      return bc - ac;
    })
    .slice(0, 8);
  if (!tokenRows.length) return renderEmptyList("No guild tokens yet.");

  return tokenRows
    .map((raw) => {
      const row = /** @type {Record<string, unknown>} */ (raw);
      const guildId = String(row.guild_id ?? "");
      const denom = String(row.denom ?? "");
      const supply = formatUnitOrDash(row.supply, denom || "uguild");
      return `
        <div class="sg-bank-aside__row">
          <div class="sg-bank-aside__row-left">
            <p class="sg-bank-aside__row-name">${renderEntityLink(guildId, lookup)}</p>
          </div>
          <p class="sg-bank-aside__row-value">${escapeHtml(supply)}</p>
        </div>
      `;
    })
    .join("");
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
