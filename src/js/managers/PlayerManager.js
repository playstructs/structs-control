import { keys } from "../store/keys.js";
import {
  buildGuildMembershipKick,
  buildPlayerUpdateName,
  buildPlayerUpdatePfp,
} from "../util/txMessages.js";

export class PlayerManager {
  /**
   * @param {{ store: import("../store/Store.js").Store, guildAPI: import("../api/GuildAPI.js").GuildAPI }} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.guildAPI = deps.guildAPI;
  }

  _creator() {
    return this.store.session?.data?.address ?? "";
  }

  /** @param {string} playerId */
  fetchPlayer(playerId) {
    return this.store.query(keys.player(playerId), () => this.guildAPI.getPlayer(playerId));
  }

  /** @param {string} playerId */
  fetchAddresses(playerId) {
    return this.store.query(keys.playerAddresses(playerId), () => this.guildAPI.getPlayerAddressList(playerId));
  }

  /** @param {string} playerId */
  fetchInfusion(playerId) {
    return this.store.query(keys.playerInfusion(playerId), () => this.guildAPI.getInfusionByPlayer(playerId));
  }

  /**
   * Update player name via on-chain MsgPlayerUpdateName (v0.16+).
   * @param {string} playerId
   * @param {string} newName
   */
  buildUpdateNameMessage(playerId, newName) {
    return buildPlayerUpdateName({ creator: this._creator(), playerId, name: newName });
  }

  /**
   * Update player avatar URL via on-chain MsgPlayerUpdatePfp (v0.16+).
   * @param {string} playerId
   * @param {string} pfp
   */
  buildUpdatePfpMessage(playerId, pfp) {
    return buildPlayerUpdatePfp({ creator: this._creator(), playerId, pfp });
  }

  /**
   * Optimistic username update via chain tx.
   * @param {string} playerId
   * @param {string} newName
   */
  async updateUsername(playerId, newName) {
    const prev = this.store.read(keys.player(playerId));
    const prevData = /** @type {import("../types/api.js").PlayerData | null} */ (prev.data);
    const optimistic = { ...(prevData ?? {}), name: newName };
    this.store.write(keys.player(playerId), {
      status: "success",
      data: optimistic,
      error: null,
      updatedAt: Date.now(),
      stale: true,
    });
    try {
      const msg = this.buildUpdateNameMessage(playerId, newName);
      await this.store.tx?.enqueue(msg, { invalidate: [keys.player(playerId)] });
    } catch (e) {
      this.store.write(keys.player(playerId), { ...prev, stale: true });
      throw e;
    }
  }

  /**
   * @param {string} playerId
   * @param {string} pfp
   */
  async updatePfp(playerId, pfp) {
    const prev = this.store.read(keys.player(playerId));
    const prevData = /** @type {import("../types/api.js").PlayerData | null} */ (prev.data);
    const optimistic = { ...(prevData ?? {}), pfp };
    this.store.write(keys.player(playerId), {
      status: "success",
      data: optimistic,
      error: null,
      updatedAt: Date.now(),
      stale: true,
    });
    try {
      const msg = this.buildUpdatePfpMessage(playerId, pfp);
      await this.store.tx?.enqueue(msg, { invalidate: [keys.player(playerId)] });
    } catch (e) {
      this.store.write(keys.player(playerId), { ...prev, stale: true });
      throw e;
    }
  }

  /**
   * Build a kick tx (used by Players bulk page).
   * @param {string} playerId
   * @param {string} guildId
   */
  buildKickMessage(playerId, guildId) {
    return buildGuildMembershipKick({ creator: this._creator(), guildId, playerId });
  }
}
