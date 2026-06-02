import { AbstractGrassListener } from "../framework/AbstractGrassListener.js";
import { keys } from "../store/keys.js";

export class SubstationListener extends AbstractGrassListener {
  /**
   * @param {import("../store/Store.js").Store} store
   */
  constructor(store) {
    super("SubstationListener");
    this.store = store;
  }

  handler(data) {
    if (!data?.substation_id) return;
    this.store.invalidate(keys.substation(String(data.substation_id)));
    this.store.invalidate(keys.substationList());
  }
}
