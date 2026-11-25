import { GuildAPIError } from "../errors/GuildAPIError.js";
import { keys } from "../store/keys.js";
import {
  buildSubstationPlayerMigrate,
  buildSubstationUpdateConnectionCapacityMaximum,
} from "../util/txMessages.js";

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
   * All players connected to substations in this guild (aggregated per-substation lists).
   * @param {string} guildId
   */
  fetchGridPlayers(guildId) {
    return this.store.query(keys.energyGridPlayers(guildId), () => this.fetchAllGridPlayers());
  }

  /** @returns {Promise<import("../types/api.js").PlayerData[]>} */
  async fetchAllGridPlayers() {
    const substations = await this.guildAPI.getSubstationList();
    const ids = (Array.isArray(substations) ? substations : [])
      .map((s) => String(s.id))
      .filter(Boolean);
    const batches = await Promise.all(ids.map((id) => this.fetchPlayersForGrid(id)));
    return batches.flat();
  }

  /**
   * @param {string} substationId
   * @returns {Promise<import("../types/api.js").PlayerData[]>}
   */
  async fetchPlayersForGrid(substationId) {
    try {
      const players = await this.guildAPI.getSubstationPlayers(substationId);
      return (Array.isArray(players) ? players : []).map((p) => ({
        ...p,
        substation_id: p.substation_id ?? /** @type {{ substationId?: string }} */ (p).substationId ?? substationId,
      }));
    } catch (err) {
      if (err instanceof GuildAPIError && err.missing) return [];
      throw err;
    }
  }

  /**
   * @param {string} creator
   * @param {string} substationId destination substation
   * @param {string[]} playerIds
   */
  buildMigrateMessage(creator, substationId, playerIds) {
    return buildSubstationPlayerMigrate({ creator, substationId, playerIds });
  }

  /**
   * @param {string} creator
   * @param {string} destSubstationId
   * @param {string[]} playerIds
   * @param {string} guildId
   * @param {string[]} [sourceSubstationIds]
   */
  enqueueMigrate(creator, destSubstationId, playerIds, guildId, sourceSubstationIds = []) {
    const msg = this.buildMigrateMessage(creator, destSubstationId, playerIds);
    const invalidate = new Set([
      keys.substationList(),
      keys.gridIndex(),
      keys.guildRoster(guildId),
      keys.energyGridPlayers(guildId),
      keys.substationPlayers(destSubstationId),
    ]);
    for (const id of playerIds) invalidate.add(keys.player(id));
    for (const id of sourceSubstationIds) invalidate.add(keys.substationPlayers(id));
    return this.store.tx?.enqueue(msg, { invalidate: [...invalidate] });
  }

  /**
   * Cap per-player connection draw (structsd v0.23.0). Pass 0 to clear.
   * @param {string} creator
   * @param {string} substationId
   * @param {string | number} connectionCapacityMaximum
   */
  enqueueConnectionCapacityMaximum(creator, substationId, connectionCapacityMaximum) {
    const msg = buildSubstationUpdateConnectionCapacityMaximum({
      creator,
      substationId,
      connectionCapacityMaximum,
    });
    return this.store.tx?.enqueue(msg, {
      invalidate: [keys.substation(substationId), keys.substationList(), keys.gridIndex()],
    });
  }
}
