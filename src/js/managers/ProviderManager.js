import { keys } from "../store/keys.js";

export class ProviderManager {
  /**
   * @param {{ store: import("../store/Store.js").Store, guildAPI: import("../api/GuildAPI.js").GuildAPI }} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.guildAPI = deps.guildAPI;
  }

  fetchList() {
    return this.store.query(keys.providerList(), () => this.guildAPI.getProviderList());
  }
}
