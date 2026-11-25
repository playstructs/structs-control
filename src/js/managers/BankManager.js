import { keys } from "../store/keys.js";
import {
  buildGuildBankMint,
  buildGuildBankRedeem,
  buildGuildBankConfiscateAndBurn,
} from "../util/txMessages.js";

/**
 * Guild bank reads + mint/redeem/confiscate tx builders.
 * Reads go through Symfony `/guild-bank`, `/guild-bank/{id}/history`,
 * `/inventory/...`, and `/leaderboard/guild` (see InventoryController /
 * LeaderboardController in structs-webapp).
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
   * Full guild-bank catalog (optional — 404 → missing).
   */
  async fetchAllBanks() {
    return this.store.query(keys.guildBankAll(), () => this.guildAPI.getGuildBank());
  }

  /**
   * This guild's bank row (collateral / supply / ratio / denom).
   * @param {string} guildId
   */
  async fetchBalance(guildId) {
    const id = String(guildId);
    return this.store.query(keys.guildBankBalance(id), async () => {
      const rows = await this.guildAPI.getGuildBank();
      const forGuild = rows.filter((r) => String(r.guild_id) === id);
      if (!forGuild.length) return null;
      const tokenRow =
        forGuild.find((r) => String(r.denom ?? "").startsWith("uguild.")) ?? forGuild[0];
      return normalizeBankRow(tokenRow);
    });
  }

  /**
   * @param {string} guildId
   * @param {string} [bucket]
   */
  async fetchHistory(guildId, bucket = "1d") {
    return this.store.query(keys.guildBankHistory(guildId, bucket), () =>
      this.guildAPI.getGuildBankHistory(guildId, bucket),
    );
  }

  /**
   * Top holders for a denom (Top Accounts card).
   * @param {string} denom
   * @param {number} [page]
   */
  async fetchTopAccounts(denom, page = 1) {
    if (!denom) return null;
    return this.store.query(keys.inventoryByDenom(denom, page), () =>
      this.guildAPI.getInventoryByDenom(denom, page, 25),
    );
  }

  /**
   * Guild leaderboard ordered by collateral (for ranks / Top Tokens context).
   */
  async fetchGuildLeaderboard() {
    return this.store.query(keys.leaderboard("guild"), () =>
      this.guildAPI.getLeaderboard("guild", { order: "collateral.desc", limit: 50 }),
    );
  }

  /**
   * Cache keys to invalidate after a bank mutation.
   * @param {string} guildId
   * @param {string} [denom]
   * @returns {import("../store/keys.js").CacheKey[]}
   */
  invalidateKeys(guildId, denom) {
    /** @type {import("../store/keys.js").CacheKey[]} */
    const list = [
      keys.guildBankBalance(guildId),
      keys.guildBankAll(),
      keys.guildBankHistory(guildId, "1d"),
      keys.guildBankHistory(guildId, "1h"),
      keys.leaderboard("guild"),
    ];
    if (denom) list.push(keys.inventoryByDenom(denom, 1));
    return list;
  }

  /**
   * @param {{
   *   amountAlpha: string | number,
   *   amountToken: string | number,
   *   guildId?: string,
   * }} body
   */
  buildMint(body) {
    return buildGuildBankMint({
      creator: this._creator(),
      amountAlpha: body.amountAlpha,
      amountToken: body.amountToken,
      guildId: body.guildId,
    });
  }

  /**
   * @param {{ amount: string, denom: string, minAmountAlpha?: string | number }} body
   */
  buildRedeem(body) {
    return buildGuildBankRedeem({
      creator: this._creator(),
      amount: body.amount,
      denom: body.denom,
      minAmountAlpha: body.minAmountAlpha,
    });
  }

  /**
   * @param {{
   *   fromAddress: string,
   *   amountToken: string | number,
   *   guildId?: string,
   * }} body
   */
  buildConfiscateAndBurn(body) {
    return buildGuildBankConfiscateAndBurn({
      creator: this._creator(),
      fromAddress: body.fromAddress,
      amountToken: body.amountToken,
      guildId: body.guildId,
    });
  }
}

/**
 * @param {Record<string, unknown>} row
 */
function normalizeBankRow(row) {
  return {
    guild_id: String(row.guild_id ?? ""),
    denom: String(row.denom ?? ""),
    collateral: row.collateral,
    supply: row.supply,
    ratio: row.ratio,
    // Compatibility aliases used by older BankController pickers.
    amount: row.collateral,
    total_supply: row.supply,
    token_supply: row.supply,
    bank_collateral: row.collateral,
  };
}
