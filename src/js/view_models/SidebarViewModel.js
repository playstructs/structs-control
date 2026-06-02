import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { SIDEBAR_ITEMS } from "../constants/Sidebar.js";
import { EVENTS } from "../constants/Events.js";

/**
 * Left sidebar -- exactly 5 items, collapsible. The brief mandates this list
 * and these icons; do not add/remove/reorder without an explicit design change.
 */
export class SidebarViewModel extends AbstractViewModel {
  /**
   * @param {{ router: import("../framework/MenuPageRouter.js").MenuPageRouter, store: import("../store/Store.js").Store }} deps
   */
  constructor(deps) {
    super();
    this.router = deps.router;
    this.store = deps.store;
    this.expanded = false;
    /** @type {string | undefined} */
    this.activeSidebarId = undefined;
    this.router.onChange((state) => {
      this.activeSidebarId = state.route.sidebar;
      this.update();
    });
  }

  render() {
    const guildResource = this.store.read(["guild", "this"]);
    const guildName = /** @type {{ name?: string } | null} */ (guildResource.data)?.name ?? "Guild";
    const initial = (guildName[0] ?? "G").toUpperCase();

    const items = SIDEBAR_ITEMS.map((item) => {
      const active = item.id === this.activeSidebarId ? "is-active" : "";
      return `
        <li>
          <a class="sg-sidebar__item ${active}" data-action="goto" data-path="${escapeAttr(item.defaultPath)}" data-sidebar-id="${escapeAttr(item.id)}" title="${escapeAttr(item.label)}">
            <span class="sg-sidebar__icon"><i class="bi ${escapeAttr(item.icon)}"></i></span>
            <span class="sg-sidebar__label">${escapeHtml(item.label)}</span>
          </a>
        </li>
      `;
    }).join("");

    return `
      <div class="sg-sidebar__top">
        <div class="sg-sidebar__guild-meta">
          <div class="sg-sidebar__avatar" aria-hidden="true">${escapeHtml(initial)}</div>
          <div class="sg-sidebar__name">${escapeHtml(guildName)}</div>
        </div>
        <button type="button" class="sg-sidebar__toggle" data-action="toggle" aria-label="${this.expanded ? "Collapse" : "Expand"} sidebar">
          <i class="bi bi-three-dots"></i>
        </button>
      </div>
      <ul class="sg-sidebar__nav">
        ${items}
      </ul>
    `;
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
    this.container.querySelector('[data-action="toggle"]')?.addEventListener("click", () => {
      this.expanded = !this.expanded;
      window.dispatchEvent(new CustomEvent(EVENTS.SIDEBAR_TOGGLED, { detail: { expanded: this.expanded } }));
    });
  }
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
