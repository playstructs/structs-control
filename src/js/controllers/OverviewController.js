import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { statCard } from "../view_models/components/StatCard.js";
import { keys } from "../store/keys.js";
import { formatUnitOrDash } from "../util/unitDisplay.js";
import { buildEntityLookup } from "../util/entityLookup.js";
import { renderEntityLink, renderEntityRef } from "../util/entityLink.js";

export class OverviewController extends AbstractController {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   layout: import("../view_models/LayoutViewModel.js").LayoutViewModel,
   *   guildManager: import("../managers/GuildManager.js").GuildManager,
   *   substationManager: import("../managers/SubstationManager.js").SubstationManager,
   * }} deps
   */
  constructor(deps) {
    super("Overview", deps.store);
    this.layout = deps.layout;
    this.guildManager = deps.guildManager;
    this.substationManager = deps.substationManager;
  }

  async activate(_page, _params) {
    const session = this.store.session?.data;
    if (!session) return;
    void this.guildManager.fetchGuild(session.guildId);
    void this.guildManager.fetchRoster(session.guildId);
    void this.guildManager.fetchMembersCount(session.guildId);
    void this.guildManager.fetchPowerStats(session.guildId);
    void this.substationManager.fetchList();

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
    this.subscribe(this.store, keys.guildRoster(this.guildId));
    this.subscribe(this.store, keys.guildMembersCount(this.guildId));
    this.subscribe(this.store, keys.guildPowerStats(this.guildId));
    this.subscribe(this.store, keys.substationList());
  }

  render() {
    const guild = this.store.read(keys.guild(this.guildId));
    const roster = this.store.read(keys.guildRoster(this.guildId));
    const memberCount = this.store.read(keys.guildMembersCount(this.guildId));
    const powerStats = this.store.read(keys.guildPowerStats(this.guildId));
    const substations = this.store.read(keys.substationList());

    const guildData = /** @type {import("../types/api.js").GuildData | null} */ (guild.data);
    const rosterData = /** @type {import("../types/api.js").PlayerData[] | null} */ (roster.data);
    const substationData = /** @type {import("../types/api.js").SubstationData[] | null} */ (substations.data);

    const powerData = /** @type {Record<string, unknown> | null} */ (powerStats.data);
    const lookup = buildEntityLookup(this.store);

    const stats = `
      <div class="sg-stat-grid">
        ${statCard({ label: "Guild ID", valueHtml: renderEntityLink(this.guildId, lookup) })}
        ${statCard({ label: "Players", value: String(memberCount.data ?? rosterData?.length ?? "—") })}
        ${statCard({ label: "Substations", value: String(substations.status === "missing" ? "—" : substationData?.length ?? "—") })}
        ${statCard({ label: "Reactor", valueHtml: renderEntityRef(guildData?.reactor_id, lookup) })}
        ${statCard({ label: "Guild power", value: formatUnitOrDash(powerData?.power ?? powerData?.total_power, "milliwatt") })}
      </div>
    `;

    const config = ResourceView.render(guild, {
      success: (raw) => {
        const g = /** @type {import("../types/api.js").GuildData | null} */ (raw);
        return `
          <div class="sg-card">
            <div class="sg-card__title">Guild config</div>
            <dl class="row mb-0">
              ${row("Name", g?.name)}
              ${entityRow("Reactor", g?.reactor_id, lookup)}
              ${entityRow("Owner", g?.owner_id, lookup)}
              ${entityRow("Entry substation", g?.entry_substation_id, lookup)}
              ${row("Join infusion minimum", formatUnitOrDash(g?.join_infusion_minimum, "ualpha"))}
              ${row("Endpoint", g?.endpoint)}
              ${row("Chain WS", g?.client_websocket)}
              ${row("GRASS WS", g?.grass_nats_websocket)}
            </dl>
          </div>
        `;
      },
    });

    return `
      ${LayoutViewModel.pageHeader({ title: "Overview", subtitle: "Guild snapshot and configuration." })}
      ${stats}
      ${config}
    `;
  }
}

function entityRow(label, value, lookup) {
  if (value == null || value === "") return "";
  return `
    <dt class="col-sm-4 text-secondary fw-normal small text-uppercase">${escapeHtml(label)}</dt>
    <dd class="col-sm-8 mb-2">${renderEntityRef(value, lookup)}</dd>
  `;
}

function row(label, value) {
  if (value == null || value === "") return "";
  return `
    <dt class="col-sm-4 text-secondary fw-normal small text-uppercase">${escapeHtml(label)}</dt>
    <dd class="col-sm-8 mb-2">${escapeHtml(String(value))}</dd>
  `;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
