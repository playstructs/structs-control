import { keys } from "../store/keys.js";
import {
  buildGuildBankMint,
  buildGuildBankRedeem,
  buildGuildBankConfiscateAndBurn,
} from "../util/txMessages.js";

/**
 * Guild bank reads + mint/redeem/confiscate tx builders.
 * Signing goes through `store.tx.enqueue()`.
 */
export class BankManager {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   guildAPI: import("../api/GuildAPI.js").GuildAPI,
   * }} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.guildAPI = deps.guildAPI;
  }

  _creator() {
    return this.store.session?.data?.address ?? "";
  }

  /**
   * Optional balance read — 404 becomes Resource{status:"missing"}.
   * @param {string} guildId
   */
  async fetchBalance(guildId) {
    return this.store.query(keys.guildBankBalance(guildId), () => this.guildAPI.getGuildBankBalance(guildId));
  }

  /**
   * @param {{ amountAlpha: string | number, amountToken: string | number }} body
   */
  buildMint(body) {
    return buildGuildBankMint({
      creator: this._creator(),
      amountAlpha: body.amountAlpha,
      amountToken: body.amountToken,
    });
  }

  /**
   * @param {{ amount: string, denom: string }} body
   */
  buildRedeem(body) {
    return buildGuildBankRedeem({
      creator: this._creator(),
      amount: body.amount,
      denom: body.denom,
    });
  }

  /**
   * @param {{ fromAddress: string, amountToken: string | number }} body
   */
  buildConfiscateAndBurn(body) {
    return buildGuildBankConfiscateAndBurn({
      creator: this._creator(),
      fromAddress: body.fromAddress,
      amountToken: body.amountToken,
    });
  }
}
