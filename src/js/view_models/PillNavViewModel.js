import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { SIDEBAR_ITEMS } from "../constants/Sidebar.js";

/**
 * Horizontal pill nav under the header. Visible only when the active sidebar
 * section has more than one pill -- otherwise the container stays empty (and
 * CSS hides it via `:empty`).
 */
export class PillNavViewModel extends AbstractViewModel {
  /**
   * @param {{ router: import("../framework/MenuPageRouter.js").MenuPageRouter }} deps
   */
  constructor(deps) {
    super();
    this.router = deps.router;
    /** @type {string | undefined} */
    this.sidebarId = undefined;
    /** @type {string | undefined} */
    this.activePath = undefined;
    this.router.onChange((state) => {
      this.sidebarId = state.route.sidebar;
      this.activePath = state.route.pill ?? state.route.path;
      this.update();
    });
  }

  render() {
    if (!this.sidebarId) return "";
    const item = SIDEBAR_ITEMS.find((s) => s.id === this.sidebarId);
    if (!item || !item.pills || item.pills.length < 2) return "";

    return item.pills
      .map(
        (p) =>
          `<a class="sg-pillnav__pill ${p.path === this.activePath ? "is-active" : ""}" data-action="goto" data-path="${escapeAttr(p.path)}">${escapeHtml(p.label)}</a>`,
      )
      .join("");
  }

  bind() {
    if (!this.container) return;
    this.container.querySelectorAll('[data-action="goto"]').forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const path = /** @type {HTMLElement} */ (el).dataset.path;
        if (path) this.router.goto(path);
      });
    });
  }
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
