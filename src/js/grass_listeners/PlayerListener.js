import { AbstractGrassListener } from "../framework/AbstractGrassListener.js";
import { keys } from "../store/keys.js";

/**
 * Player updates -- invalidates the player cache key directly. The
 * invalidationBridge already covers most cases generically; this listener is
 * here as the canonical example and also handles guild roster invalidation
 * when a player changes guild rank or moves.
 */
export class PlayerListener extends AbstractGrassListener {
  /**
   * @param {import("../store/Store.js").Store} store
   */
  constructor(store) {
    super("PlayerListener");
    this.store = store;
  }

  handler(data) {
    if (!data?.player_id) return;
    this.store.invalidate(keys.player(String(data.player_id)));
    if (data.guild_id) {
      this.store.invalidate(keys.guildRoster(String(data.guild_id)));
      this.store.invalidate(keys.guildMembersCount(String(data.guild_id)));
    }
  }
}
