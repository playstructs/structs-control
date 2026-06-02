import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";

export class __NAME__Controller extends AbstractController {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   layout: import("../view_models/LayoutViewModel.js").LayoutViewModel,
   * }} deps
   */
  constructor(deps) {
    super("__NAME__", deps.store);
    this.layout = deps.layout;
  }

  activate(_page, _params) {
    this.layout.mountContent(new __NAME__ViewModel({ store: this.store }));
  }
}

class __NAME__ViewModel extends AbstractViewModel {
  /**
   * @param {{ store: import("../store/Store.js").Store }} deps
   */
  constructor(deps) {
    super();
    this.store = deps.store;
  }

  mount(container) {
    super.mount(container);
    // TODO: this.subscribe(this.store, keys.__name__(...));
  }

  render() {
    return `
      ${LayoutViewModel.pageHeader({ title: "__NAME__", subtitle: "TODO." })}
      <div class="sg-empty">
        <div class="sg-empty__title">TODO</div>
        <div class="sg-empty__hint">Implement render() in __NAME__Controller.js.</div>
      </div>
    `;
  }
}
