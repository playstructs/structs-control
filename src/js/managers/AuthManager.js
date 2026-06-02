import { notify } from "../store/notify.js";
import { EVENTS } from "../constants/Events.js";

/**
 * Cosmos-wallet authentication flow, port of the structs-webapp `AuthManager`
 * pared down to what the admin SPA needs.
 *
 * Flow:
 *   1. mnemonic -> wallet -> address + pubkey  (WalletManager)
 *   2. GET /timestamp                          (GuildAPI)
 *   3. msg = `LOGIN_GUILD{guildId}ADDRESS{address}DATETIME{ts}`
 *   4. SHA256 + secp256k1 sign -> hex          (WalletManager)
 *   5. GET /auth/player-address/{addr}/guild/{guildId}/player-id  (GuildAPI)
 *   6. POST /auth/login                                            (GuildAPI)
 *   7. Persist {mnemonic, address, pubkey, playerId, guildId} to sessionStorage
 *   8. Hand the wallet to SigningClientManager so tx queue can broadcast
 */
export class AuthManager {
  /**
   * @param {{
   *   guildAPI: import("../api/GuildAPI.js").GuildAPI,
   *   walletManager: import("./WalletManager.js").WalletManager,
   *   signingClientManager: import("./SigningClientManager.js").SigningClientManager,
   *   store: import("../store/Store.js").Store,
   * }} deps
   */
  constructor(deps) {
    this.guildAPI = deps.guildAPI;
    this.walletManager = deps.walletManager;
    this.signingClientManager = deps.signingClientManager;
    this.store = deps.store;
  }

  /**
   * Run the full sign-in flow.
   *
   * @param {string} mnemonic
   * @param {string} guildId
   * @returns {Promise<{ playerId: string, address: string }>}
   */
  async login(mnemonic, guildId) {
    const wallet = await this.walletManager.createWallet(mnemonic);
    // getAccountsWithPrivkeys is technically "private" in cosmjs types but
    // it's the standard way to sign proxy messages, as in structs-webapp.
    const accounts = await /** @type {any} */ (wallet).getAccountsWithPrivkeys();
    const account = accounts?.[0];
    if (!account) throw new Error("Wallet produced no accounts");
    const address = account.address;
    const pubkey = this.walletManager.bytesToHex(account.pubkey);

    const timestamp = await this.guildAPI.getTimestamp();
    const message = this.guildAPI.buildLoginMessage(guildId, address, timestamp);
    const signature = await this.walletManager.signMessage(message, account.privkey);

    const playerId = await this.guildAPI.getPlayerIdByAddressAndGuild(address, guildId);
    if (!playerId) throw new Error("Address is not registered as a player in this guild");

    await this.guildAPI.login({
      address,
      pubkey,
      guild_id: guildId,
      unix_timestamp: timestamp,
      signature,
    });

    if (!this.store.session) throw new Error("Store.session not attached");
    this.store.session.persist({ mnemonic, address, pubkey, playerId, guildId });

    await this.signingClientManager.connect(wallet, address);

    window.dispatchEvent(new CustomEvent(EVENTS.AUTH_LOGIN, { detail: { playerId, address } }));
    notify.toast("Signed in", "success");

    return { playerId, address };
  }

  /**
   * Probe the current session: if sessionStorage has credentials, verify the
   * cookie is still good by fetching the player. Returns true if authenticated.
   *
   * @returns {Promise<boolean>}
   */
  async restore() {
    const session = this.store.session;
    if (!session) return false;
    session.hydrate();
    if (!session.isAuthenticated() || !session.data) return false;
    try {
      await this.guildAPI.getPlayer(session.data.playerId);
    } catch (e) {
      console.warn("[AuthManager.restore] session cookie invalid; clearing", e);
      session.clear();
      return false;
    }
    // Reconnect signing client; chain WS may be down without invalidating the API session.
    try {
      const wallet = await this.walletManager.createWallet(session.data.mnemonic);
      const accounts = await /** @type {any} */ (wallet).getAccountsWithPrivkeys();
      const account = accounts?.[0];
      if (!account) throw new Error("Restored wallet produced no accounts");
      await this.signingClientManager.connect(wallet, account.address);
    } catch (e) {
      console.warn("[AuthManager.restore] signing client unavailable; session kept", e);
    }
    return true;
  }

  async logout() {
    try {
      await this.guildAPI.logout();
    } catch (e) {
      console.warn("[AuthManager.logout] API logout failed (continuing):", e);
    }
    this.signingClientManager.disconnect();
    this.store.session?.clear();
    this.store.clear();
    window.dispatchEvent(new CustomEvent(EVENTS.AUTH_LOGOUT));
  }
}
