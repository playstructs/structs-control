import { NotImplementedError } from "../errors/NotImplementedError.js";

/**
 * Base class for NATS/GRASS listeners. The preferred pattern in this app is to
 * declare which cache keys an event invalidates via the `invalidationBridge`
 * instead of running ad-hoc fetches inside `handler()` -- that way every
 * subscribed view model refreshes automatically.
 */
export class AbstractGrassListener {
  /**
   * @param {string} name
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * @param {object} _messageData
   */
  handler(_messageData) {
    throw new NotImplementedError(`${this.name}.handler`);
  }

  shouldUnregister() {
    return false;
  }
}
