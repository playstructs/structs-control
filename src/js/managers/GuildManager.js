import { keys } from "../store/keys.js";

/**
 * Thin orchestrator over GuildAPI + Store. Pages call these methods; the
 * Manager handles cache keys, staleness, and any pre/post-processing.
 *
 * NEVER call this.guildAPI directly from a view model -- always go through a
 * Manager so the cache is consistent.
 */
export class GuildManager {
  /**
   * @param {{ store: import("../store/Store.js").Store, guildAPI: import("../api/GuildAPI.js").GuildAPI }} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.guildAPI = deps.guildAPI;
  }

  /** @param {string} guildId */
  async fetchGuild(guildId) {
    return this.store.query(keys.guild(guildId), () => this.guildAPI.getGuild(guildId));
  }

  async fetchThisGuild() {
    return this.store.query(keys.guildThis(), () => this.guildAPI.getThisGuild(), { staleTime: 60_000 });
  }

  /** @param {string} guildId */
  async fetchRoster(guildId) {
    return this.store.query(keys.guildRoster(guildId), () => this.guildAPI.getGuildRoster(guildId));
  }

  /** @param {string} guildId */
  async fetchMembersCount(guildId) {
    return this.store.query(keys.guildMembersCount(guildId), () => this.guildAPI.countGuildMembers(guildId));
  }

  /** @param {string} guildId */
  async fetchPowerStats(guildId) {
    return this.store.query(keys.guildPowerStats(guildId), () => this.guildAPI.getGuildPowerStats(guildId));
  }

  async fetchSettings() {
    return this.store.query(keys.guildSettings(), () => this.guildAPI.getSettings(), { staleTime: 5 * 60_000 });
  }
}
