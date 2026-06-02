/**
 * Owns the sessionStorage <-> cookie boot dance.
 *
 * sessionStorage shape:
 *   STRUCTS_SESSION = {
 *     mnemonic: string,
 *     address:  string,
 *     pubkey:   string,
 *     playerId: string,
 *     guildId:  string,
 *   }
 *
 * The cookie itself is HttpOnly and managed by the Guild API. We can't read it
 * directly; we infer validity by trying a probe request (`GET /api/player/{id}`).
 *
 * Mnemonic NEVER goes in localStorage. Period.
 */

const STORAGE_KEY = "STRUCTS_SESSION";

/**
 * @typedef {{
 *   mnemonic: string,
 *   address: string,
 *   pubkey: string,
 *   playerId: string,
 *   guildId: string,
 * }} SessionData
 */

export class Session {
  constructor() {
    /** @type {SessionData | null} */
    this.data = null;
  }

  /**
   * Read whatever sessionStorage has. Doesn't validate against the network.
   */
  hydrate() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      this.data = raw ? JSON.parse(raw) : null;
    } catch {
      this.data = null;
    }
    return this.data;
  }

  /**
   * @param {SessionData} data
   */
  persist(data) {
    this.data = data;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  clear() {
    this.data = null;
    sessionStorage.removeItem(STORAGE_KEY);
  }

  isAuthenticated() {
    return Boolean(this.data && this.data.playerId && this.data.guildId);
  }
}
