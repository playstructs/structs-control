import { NotImplementedError } from "../errors/NotImplementedError.js";

/**
 * Stateless renderable that returns an HTML string. Components are composed
 * into view models via template-literal interpolation.
 *
 * Components MAY define a `bind(rootEl)` method that the parent view model calls
 * after attaching the rendered HTML to the DOM.
 */
export class AbstractViewModelComponent {
  /**
   * @param {Record<string, unknown>} [_props]
   * @returns {string}
   */
  renderHTML(_props) {
    throw new NotImplementedError(`${this.constructor.name}.renderHTML`);
  }

  /**
   * Optional hook. Called by the parent view model after the HTML is in the DOM.
   * @param {HTMLElement} _rootEl
   */
  bind(_rootEl) {}
}
