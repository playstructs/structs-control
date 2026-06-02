import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { HeaderViewModel } from "./HeaderViewModel.js";
import { SidebarViewModel } from "./SidebarViewModel.js";
import { PillNavViewModel } from "./PillNavViewModel.js";
import { EVENTS } from "../constants/Events.js";

/**
 * The 3-part app shell. Owns the grid layout and mounts Header/Sidebar/PillNav.
 * Provides `mountContent(viewModel)` which controllers use to swap in pages.
 *
 * Login view replaces the entire #app with a centred form -- the layout shell
 * is only mounted post-login.
 */
export class LayoutViewModel extends AbstractViewModel {
  /**
   * @param {{
   *   store: import("../store/Store.js").Store,
   *   router: import("../framework/MenuPageRouter.js").MenuPageRouter,
   *   onLogout: () => void,
   * }} deps
   */
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.onLogout = deps.onLogout;
    this.header = new HeaderViewModel({ store: this.store, router: this.router, onLogout: this.onLogout });
    this.sidebar = new SidebarViewModel({ store: this.store, router: this.router });
    this.pillNav = new PillNavViewModel({ router: this.router });
    /** @type {AbstractViewModel | null} */
    this.activePage = null;

    window.addEventListener(EVENTS.SIDEBAR_TOGGLED, (e) => {
      const expanded = /** @type {CustomEvent<{ expanded: boolean }>} */ (e).detail?.expanded;
      const shell = document.getElementById("sg-shell");
      if (shell) shell.dataset.sidebar = expanded ? "expanded" : "collapsed";
    });

    this._unsubs.push(this.store.subscribe(["guild", "this"], () => this.sidebar.update()));
  }

  render() {
    return `
      <div id="sg-shell" class="sg-shell" data-sidebar="collapsed">
        <header class="sg-header" id="sg-header"></header>
        <aside class="sg-sidebar" id="sg-sidebar"></aside>
        <main class="sg-content">
          <nav class="sg-pillnav" id="sg-pillnav"></nav>
          <section class="sg-page" id="sg-page"></section>
        </main>
      </div>
    `;
  }

  bind() {
    if (!this.container) return;
    const header = /** @type {HTMLElement} */ (this.container.querySelector("#sg-header"));
    const sidebar = /** @type {HTMLElement} */ (this.container.querySelector("#sg-sidebar"));
    const pill = /** @type {HTMLElement} */ (this.container.querySelector("#sg-pillnav"));
    if (header) this.header.mount(header);
    if (sidebar) this.sidebar.mount(sidebar);
    if (pill) this.pillNav.mount(pill);
  }

  /**
   * Replace the page content area with a freshly mounted view model.
   * @param {AbstractViewModel} viewModel
   */
  mountContent(viewModel) {
    const slot = document.getElementById("sg-page");
    if (!slot) return;
    if (this.activePage) this.activePage.unmount();
    this.activePage = viewModel;
    viewModel.mount(slot);
  }

  /**
   * Set the page title / sub-title chrome shown above the content slot. Used
   * by simple controllers; complex pages render their own header.
   * @param {{ title: string, subtitle?: string, actionsHtml?: string }} props
   */
  static pageHeader(props) {
    return `
      <div class="sg-page__header">
        <div>
          <h1 class="sg-page__title">${escapeHtml(props.title)}</h1>
          ${props.subtitle ? `<p class="sg-page__subtitle">${escapeHtml(props.subtitle)}</p>` : ""}
        </div>
        ${props.actionsHtml ?? ""}
      </div>
    `;
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
