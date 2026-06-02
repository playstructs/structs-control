import { keys } from "../store/keys.js";

/**
 * Thin orchestrator between GuildAPI and the Store for the `__KEY__` domain.
 */
export class __NAME__ {
  /**
   * @param {{ store: import("../store/Store.js").Store, guildAPI: import("../api/GuildAPI.js").GuildAPI }} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.guildAPI = deps.guildAPI;
  }

  /** @param {string} id */
  fetch__NAME__(id) {
    // TODO: add keys.__KEY__(id) to src/js/store/keys.js
    return this.store.query(["__KEY__", String(id)], () => this.guildAPI./* TODO */ get__NAME__(id));
  }
}
