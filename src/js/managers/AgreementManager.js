import { keys } from "../store/keys.js";

export class AgreementManager {
  /**
   * @param {{ store: import("../store/Store.js").Store, guildAPI: import("../api/GuildAPI.js").GuildAPI }} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.guildAPI = deps.guildAPI;
  }

  /** @param {string} guildId */
  fetchByGuild(guildId) {
    return this.store.query(keys.agreementList(guildId), () => this.guildAPI.getAgreementsByGuild(guildId));
  }
}
