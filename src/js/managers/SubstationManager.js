import { keys } from "../store/keys.js";
import { MSG_TYPES } from "../constants/MessageTypes.js";

export class SubstationManager {
  /**
   * @param {{ store: import("../store/Store.js").Store, guildAPI: import("../api/GuildAPI.js").GuildAPI }} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.guildAPI = deps.guildAPI;
  }

  fetchList() {
    return this.store.query(keys.substationList(), () => this.guildAPI.getSubstationList());
  }

  /** @param {string} id */
  fetchSubstation(id) {
    return this.store.query(keys.substation(id), () => this.guildAPI.getSubstation(id));
  }

  /** @param {string} id */
  fetchPlayers(id) {
    return this.store.query(keys.substationPlayers(id), () => this.guildAPI.getSubstationPlayers(id));
  }

  /**
   * @param {string} playerId
   * @param {string} substationId
   */
  buildMigrateMessage(playerId, substationId) {
    return {
      typeUrl: MSG_TYPES.SUBSTATION_PLAYER_MIGRATE,
      value: { creator: "", player_id: playerId, substation_id: substationId },
    };
  }
}
