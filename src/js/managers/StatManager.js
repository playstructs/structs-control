import { keys } from "../store/keys.js";

export class StatManager {
  /**
   * @param {{ store: import("../store/Store.js").Store, guildAPI: import("../api/GuildAPI.js").GuildAPI }} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.guildAPI = deps.guildAPI;
  }

  /**
   * @param {string} metric
   * @param {string} objectKey
   * @param {{ startTime?: number, endTime?: number }} [range]
   */
  fetchRange(metric, objectKey, range) {
    return this.store.query(keys.statRange(metric, objectKey), () =>
      this.guildAPI.getStatRange(metric, objectKey, range),
    );
  }
}
