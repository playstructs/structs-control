import { NotImplementedError } from "../errors/NotImplementedError.js";

/**
 * Base class for all page controllers.
 *
 * A controller is the glue between a URL/route and a view model. Each public
 * `index`/`detail`/etc. method on the subclass becomes a page that the router
 * can navigate to via `router.goto(controllerName, pageName, params)`.
 *
 * Controllers MUST NOT call `fetch` directly. Read data via `store.query` and
 * mutate via `store.tx` -- see docs/ARCHITECTURE.md.
 */
export class AbstractController {
  /**
   * @param {string} name controller name (also used as routing key)
   * @param {import("../store/Store.js").Store} store
   */
  constructor(name, store) {
    this.name = name;
    this.store = store;
  }

  /**
   * Called whenever the router activates this controller for any page.
   * Override to set up sidebar/pill state, etc.
   * @param {string} _pageName
   * @param {Record<string, unknown>} _params
   */
  onActivate(_pageName, _params) {}

  /**
   * Called when the router is leaving this controller. Override to unsubscribe
   * from cache keys / remove DOM listeners.
   */
  onDeactivate() {}

  /**
   * Default page (every controller must implement at least this).
   * @param {Record<string, unknown>} _params
   * @returns {Promise<void>|void}
   */
  index(_params) {
    throw new NotImplementedError(`${this.name}.index`);
  }
}
