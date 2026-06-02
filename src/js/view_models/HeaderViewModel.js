import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { structsLogoUrl } from "../constants/Brand.js";

/**
 * Top header (65px). Logo + STRUCTS, search, pending-tx badge, address display,
 * logout button. The pending count comes from store.tx.subscribe().
 */
export class HeaderViewModel extends AbstractViewModel {
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
    this.pendingCount = 0;
    if (this.store.tx) {
      this._unsubs.push(
        this.store.tx.subscribe(() => {
          const next = this.store.tx?.pendingCount() ?? 0;
          if (next !== this.pendingCount) {
            this.pendingCount = next;
            this.update();
          }
        }),
      );
    }
  }

  render() {
    const address = this.store.session?.data?.address ?? "";
    const short = address ? `${address.slice(0, 9)}…${address.slice(-4)}` : "—";

    return `
      <a class="sg-header__brand" href="/overview" data-action="home">
        <img class="sg-header__brand-icon" src="${structsLogoUrl}" alt="" />
        <span class="sg-header__wordmark">STRUCTS</span>
      </a>
      <div class="sg-header__search-group">
        <input type="search" class="form-control form-control-sm sg-header__search-input" placeholder="Search" disabled aria-label="Search" />
        <button type="button" class="btn btn-primary btn-sm sg-header__search-btn" disabled>
          <i class="bi bi-search"></i>
          Search
        </button>
      </div>
      <div class="sg-header__actions">
        <button type="button" class="sg-header__pending" data-count="${this.pendingCount}" data-action="activity" title="Pending transactions">
          <i class="bi bi-arrow-left-right"></i>
          <span class="sg-header__pending-badge">${this.pendingCount}</span>
        </button>
        <span class="sg-header__address" title="${escapeAttr(address)}">${escapeHtml(short)}</span>
        <button type="button" class="btn btn-sm btn-light" data-action="logout">
          <i class="bi bi-box-arrow-right me-1"></i>Logout
        </button>
      </div>
    `;
  }

  bind() {
    if (!this.container) return;
    this.container.querySelector('[data-action="home"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.router.goto("/overview");
    });
    this.container.querySelector('[data-action="activity"]')?.addEventListener("click", () => {
      this.router.goto("/alerts");
    });
    this.container.querySelector('[data-action="logout"]')?.addEventListener("click", () => {
      this.onLogout();
    });
  }
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
