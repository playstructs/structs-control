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
}
