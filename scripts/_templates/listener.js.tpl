import { AbstractGrassListener } from "../framework/AbstractGrassListener.js";
import { keys } from "../store/keys.js";

/**
 * GRASS listener for subject `__SUBJECT__`. Invalidates the `__KEY__` cache
 * key whenever a matching message arrives so subscribed view models refresh.
 */
export class __NAME__ extends AbstractGrassListener {
  /**
   * @param {import("../store/Store.js").Store} store
   */
  constructor(store) {
    super("__NAME__");
    this.store = store;
  }

  handler(data) {
    if (!data?.__KEY___id) return;
    // TODO: pick the right key helper for your domain.
    this.store.invalidate(["__KEY__", String(data.__KEY___id)]);
  }
}
