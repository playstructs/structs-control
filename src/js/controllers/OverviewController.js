import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import {
  overviewActivityItem,
  overviewActivitySeeAll,
  overviewCardHeader,
  overviewMetricRow,
} from "../view_models/components/OverviewCard.js";
import { keys } from "../store/keys.js";
import { formatUnitOrDash } from "../util/unitDisplay.js";
import { buildEntityLookup } from "../util/entityLookup.js";
import { buildOverviewActivityItems } from "../util/activityFeed.js";

export class OverviewController extends AbstractController {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   layout: import("../view_models/LayoutViewModel.js").LayoutViewModel,
   *   guildManager: import("../managers/GuildManager.js").GuildManager,
   *   substationManager?: import("../managers/SubstationManager.js").SubstationManager,
   *   reactorManager?: import("../managers/ReactorManager.js").ReactorManager,
   *   infusionManager?: import("../managers/InfusionManager.js").InfusionManager,
   * }} deps
   */
  constructor(deps) {
    super("Overview", deps.store);
    this.layout = deps.layout;
    this.guildManager = deps.guildManager;
    this.substationManager = deps.substationManager;
    this.reactorManager = deps.reactorManager;
    this.infusionManager = deps.infusionManager;
  }

  async activate(_page, _params) {
    const session = this.store.session?.data;
    if (!session) return;
    void this.guildManager.fetchGuild(session.guildId);
    void this.guildManager.fetchMembersCount(session.guildId);
    void this.guildManager.fetchPowerStats(session.guildId);
    void this.guildManager.fetchRoster(session.guildId);
    void this.substationManager?.fetchList();
    void this.reactorManager?.fetchList(session.guildId);
    void this.infusionManager?.fetchGuildInfusions(session.guildId);

    const vm = new OverviewViewModel({ store: this.store, guildId: session.guildId });
    this.layout.mountContent(vm);
  }
}

class OverviewViewModel extends AbstractViewModel {
  /**
   * @param {{ store: import("../store/Store.js").Store, guildId: string }} deps
   */
  constructor(deps) {
    super();
    this.store = deps.store;
    this.guildId = deps.guildId;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.guild(this.guildId));
    this.subscribe(this.store, keys.guildMembersCount(this.guildId));
    this.subscribe(this.store, keys.guildPowerStats(this.guildId));
    this.subscribe(this.store, keys.substationList());
    this.subscribe(this.store, keys.guildRoster(this.guildId));
    this.subscribe(this.store, keys.reactorList(this.guildId));
    this.subscribe(this.store, keys.guildInfusions(this.guildId));
    if (this.store.tx) {
      this._unsubs.push(this.store.tx.subscribe(() => this.update()));
    }
  }

  render() {
    const guild = this.store.read(keys.guild(this.guildId));
    const memberCount = this.store.read(keys.guildMembersCount(this.guildId));
    const powerStats = this.store.read(keys.guildPowerStats(this.guildId));

    const guildData = /** @type {import("../types/api.js").GuildData | null} */ (guild.data);
    const powerData = /** @type {Record<string, unknown> | null} */ (powerStats.data);
    const members = memberCount.data ?? null;
    const guildLabel = guildData?.name ? `${guildData.name} performance` : "Your Guild performance";

    const alphaTotal = pickAlphaAmount(powerData, ["total_alpha_infused", "alpha_infused", "infused", "total_infused"]);
    const alpha7d = pickAlphaAmount(powerData, ["last_7_days", "alpha_7d", "infused_7d"]);
    const alpha24h = pickAlphaAmount(powerData, ["last_24_hours", "last_24hrs", "alpha_24h", "infused_24h"]);
    const members7d = pickScalar(powerData, ["members_7d", "membership_7d", "last_7_days_members"]);
    const members24h = pickScalar(powerData, ["members_24h", "membership_24h", "last_24_hours_members"]);

    const performanceCard = `
      <section class="sg-overview-card">
        ${overviewCardHeader({
          title: "Guild Performance",
          subtitle: guildLabel,
        })}
        <div class="sg-overview-card__body">
          ${overviewMetricRow({
            icon: "bi-gem",
            iconTone: "blue",
            label: "Total Alpha Infused",
            columns: [
              { value: formatUnitOrDash(alphaTotal, "ualpha") },
              { period: "Last 7 Days", value: formatUnitOrDash(alpha7d, "ualpha") },
              { period: "Last 24hrs", value: formatUnitOrDash(alpha24h, "ualpha") },
            ],
          })}
          ${overviewMetricRow({
            icon: "bi-people",
            iconTone: "blue",
            label: "Total Membership",
            columns: [
              { value: members == null ? "—" : String(members) },
              { period: "Last 7 Days", value: members7d == null ? "—" : String(members7d) },
              { period: "Last 24hrs", value: members24h == null ? "—" : String(members24h) },
            ],
          })}
        </div>
      </section>
    `;

    const leaderboardCard = `
      <section class="sg-overview-card">
        ${overviewCardHeader({
          title: "Community Leaderboard",
          subtitle: "Other top Guilds - ranked by total Alpha Infused",
        })}
        <div class="sg-overview-card__body sg-overview-card__body--leaderboard">
          ${renderLeaderboard()}
        </div>
      </section>
    `;

    const activityCard = `
      <section class="sg-overview-card">
        ${overviewCardHeader({
          title: "Activity",
          subtitle: "Your recent activity",
          showMenu: true,
        })}
        <div class="sg-overview-card__body sg-overview-card__body--activity">
          ${renderActivityFeed(
            this.store.tx?.list() ?? [],
            this.store.read(keys.guildInfusions(this.guildId)),
            buildEntityLookup(this.store),
          )}
        </div>
      </section>
    `;

    return `
      <div class="sg-overview">
        <div class="sg-overview__main">
          ${performanceCard}
          ${leaderboardCard}
        </div>
        <aside class="sg-overview__aside" aria-label="Recent activity">
          ${activityCard}
        </aside>
      </div>
    `;
  }
}

function renderLeaderboard() {
  return `<p class="sg-overview-empty">Community leaderboard data is not available yet.</p>`;
}

/**
 * @param {import("../store/TxQueue.js").TxRecord[]} records
 * @param {import("../store/Resource.js").Resource<unknown>} infusionRes
 * @param {import("../util/entityLookup.js").EntityLookup} lookup
 */
function renderActivityFeed(records, infusionRes, lookup) {
  const seeAll = overviewActivitySeeAll();
  const infusions =
    infusionRes.status === "success" && Array.isArray(infusionRes.data) ? infusionRes.data : [];

  if (!records.length && !infusions.length) {
    if (infusionRes.status === "loading" || infusionRes.status === "idle") {
      return `<div class="sg-loading"><div class="spinner-border spinner-border-sm text-primary"></div></div>`;
    }
    return `
      <p class="sg-overview-empty">No recent activity this session.</p>
      ${seeAll}
    `;
  }

  const items = buildOverviewActivityItems(records, /** @type {any[]} */ (infusions), lookup, { limit: 6 });
  return `${items.map((item) => overviewActivityItem(item)).join("")}${seeAll}`;
}

/**
 * @param {Record<string, unknown> | null} data
 * @param {string[]} keys
 */
function pickAlphaAmount(data, keys) {
  if (!data) return null;
  for (const key of keys) {
    if (data[key] != null && data[key] !== "") return data[key];
  }
  return null;
}

/**
 * @param {Record<string, unknown> | null} data
 * @param {string[]} keys
 */
function pickScalar(data, keys) {
  return pickAlphaAmount(data, keys);
}

