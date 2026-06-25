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

export class OverviewController extends AbstractController {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   layout: import("../view_models/LayoutViewModel.js").LayoutViewModel,
   *   guildManager: import("../managers/GuildManager.js").GuildManager,
   * }} deps
   */
  constructor(deps) {
    super("Overview", deps.store);
    this.layout = deps.layout;
    this.guildManager = deps.guildManager;
  }

  async activate(_page, _params) {
    const session = this.store.session?.data;
    if (!session) return;
    void this.guildManager.fetchGuild(session.guildId);
    void this.guildManager.fetchMembersCount(session.guildId);
    void this.guildManager.fetchPowerStats(session.guildId);

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
          showMenu: false,
        })}
        <div class="sg-overview-card__body sg-overview-card__body--activity">
          ${renderActivityFeed(this.store.tx?.list() ?? [])}
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
 */
function renderActivityFeed(records) {
  const seeAll = overviewActivitySeeAll();

  if (!records.length) {
    return `
      <p class="sg-overview-empty">No recent activity this session.</p>
      ${seeAll}
    `;
  }

  const recent = [...records].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  return `${recent.map((record) => txToActivityItem(record)).join("")}${seeAll}`;
}

/**
 * @param {import("../store/TxQueue.js").TxRecord} record
 */
function txToActivityItem(record) {
  const shortType = record.typeUrl.replace(/^.*\./, "");
  const { icon, tone } = txIcon(record.status);
  const body = [
    statusLabel(record.status),
    record.hash ? `${record.hash.slice(0, 12)}…` : null,
    record.error ? record.error : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return overviewActivityItem({
    icon,
    iconTone: tone,
    title: shortType,
    time: formatRelativeTime(record.updatedAt),
    body,
  });
}

/** @param {import("../store/TxQueue.js").TxStatus} status */
function txIcon(status) {
  if (status === "confirmed") return { icon: "bi-check-circle", tone: /** @type {const} */ ("success") };
  if (status === "failed") return { icon: "bi-x-circle", tone: /** @type {const} */ ("error") };
  if (status === "cancelled") return { icon: "bi-slash-circle", tone: /** @type {const} */ ("info") };
  if (status === "confirming") return { icon: "bi-hourglass-split", tone: /** @type {const} */ ("warning") };
  return { icon: "bi-arrow-repeat", tone: /** @type {const} */ ("info") };
}

/** @param {import("../store/TxQueue.js").TxStatus} status */
function statusLabel(status) {
  const labels = {
    pending: "Queued",
    signing: "Signing",
    confirming: "Confirming",
    confirmed: "Confirmed",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
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

/** @param {number} ts */
function formatRelativeTime(ts) {
  const delta = Date.now() - ts;
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
