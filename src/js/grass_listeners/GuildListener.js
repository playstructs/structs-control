import { AbstractGrassListener } from "../framework/AbstractGrassListener.js";
import { keys } from "../store/keys.js";

export class GuildListener extends AbstractGrassListener {
  /**
   * @param {import("../store/Store.js").Store} store
   */
  constructor(store) {
    super("GuildListener");
    this.store = store;
  }

  handler(data) {
    if (!data?.guild_id) return;
    this.store.invalidate(keys.guild(String(data.guild_id)));
    this.store.invalidate(keys.guildThis());
  }
}
