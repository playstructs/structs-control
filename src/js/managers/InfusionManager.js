import { GuildAPIError } from "../errors/GuildAPIError.js";
import { keys } from "../store/keys.js";

export class InfusionManager {
  /**
   * @param {{ store: import("../store/Store.js").Store, guildAPI: import("../api/GuildAPI.js").GuildAPI }} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.guildAPI = deps.guildAPI;
  }

  /** @param {string} playerId */
  fetchByPlayer(playerId) {
    return this.store.query(keys.playerInfusion(playerId), () => this.guildAPI.getInfusionByPlayer(playerId));
  }

  /** @param {string} reactorId */
  fetchInfusionsByReactor(reactorId) {
    return this.store.query(keys.reactorInfusion(reactorId), () => this.guildAPI.getInfusionsByReactor(reactorId));
  }

  /** @param {string} reactorId */
  fetchByReactor(reactorId) {
    return this.fetchInfusionsByReactor(reactorId);
  }

  /**
   * Aggregate infusion rows across every reactor in the guild (for Overview Activity).
   * @param {string} guildId
   */
  fetchGuildInfusions(guildId) {
    return this.store.query(keys.guildInfusions(guildId), () => this._loadGuildInfusions(guildId));
  }

  /**
   * @param {string} guildId
   * @returns {Promise<Array<import("../types/api.js").InfusionData & { reactor_id?: string }>>}
   */
  async _loadGuildInfusions(guildId) {
    const reactors = await this.guildAPI.getReactorList(guildId);
    const list = Array.isArray(reactors) ? reactors : [];
    const batches = await Promise.all(list.map((r) => this._safeReactorInfusions(String(r.id))));
    return batches.flat();
  }

  /**
   * @param {string} reactorId
   * @returns {Promise<Array<import("../types/api.js").InfusionData & { reactor_id?: string }>>}
   */
  async _safeReactorInfusions(reactorId) {
    try {
      const rows = await this.guildAPI.getInfusionsByReactor(reactorId);
      return (Array.isArray(rows) ? rows : rows ? [rows] : []).map((row) => ({
        ...row,
        reactor_id: row.reactor_id ?? row.destination_id ?? reactorId,
        destination_id: row.destination_id ?? reactorId,
      }));
    } catch (err) {
      if (err instanceof GuildAPIError && err.missing) return [];
      throw err;
    }
  }
}
