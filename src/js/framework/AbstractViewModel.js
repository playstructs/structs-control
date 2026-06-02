import { NotImplementedError } from "../errors/NotImplementedError.js";

/**
 * Base class for view models that own a region of the DOM.
 *
 * Lifecycle (in order):
 *   mount(container)   ->   render()   ->   bind()
 *   onUpdate()         (called when any subscribed Resource changes)
 *   unmount()          (cleans up subscriptions + DOM listeners)
 *
 * Subclasses MUST implement `render()`. Everything else has a default no-op.
 */
export class AbstractViewModel {
  constructor() {
    /** @type {HTMLElement | null} */
    this.container = null;
    /** @type {Array<() => void>} */
    this._unsubs = [];
    /** @type {boolean} */
    this._mounted = false;
  }

  /**
   * @param {HTMLElement} container
   */
  mount(container) {
    this.container = container;
    this._mounted = true;
    this.update();
    this.bind();
  }

  /**
   * Re-render and re-bind. Safe to call repeatedly.
   */
  update() {
    if (!this.container) return;
    this.container.innerHTML = this.render();
    this.bind();
  }

  /**
   * @returns {string} HTML string for this view model's region.
   */
  render() {
    throw new NotImplementedError(`${this.constructor.name}.render`);
  }

  /**
   * Wire DOM listeners. Called after every `render()`; idempotent because the
   * container is replaced wholesale.
   */
  bind() {}

  /**
   * Subscribe to a Store key; call `update()` on change. Returns an unsubscribe
   * function and also registers it for automatic cleanup in `unmount()`.
   *
   * @param {import("../store/Store.js").Store} store
   * @param {ReadonlyArray<string | number>} key
   * @returns {() => void}
   */
  subscribe(store, key) {
    const unsub = store.subscribe(key, () => this.update());
    this._unsubs.push(unsub);
    return unsub;
  }

  unmount() {
    for (const unsub of this._unsubs) unsub();
    this._unsubs.length = 0;
    if (this.container) this.container.innerHTML = "";
    this.container = null;
    this._mounted = false;
  }
}
