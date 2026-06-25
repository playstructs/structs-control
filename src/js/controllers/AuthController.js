import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { structsLogoUrl } from "../constants/Brand.js";
import { notify } from "../store/notify.js";
import { validateForm, required, isMnemonic, isGuildId, readFormValues } from "../util/validate.js";

/**
 * Login page. Replaces the entire #app with a centred form (no layout shell).
 *
 * Once login succeeds, the app re-bootstraps: index.js re-mounts the Layout
 * and routes to /overview.
 */
export class AuthController extends AbstractController {
  /**
   * @param {{
   *   authManager: import("../managers/AuthManager.js").AuthManager,
   *   store: import("../store/Store.js").Store,
   *   router: import("../framework/MenuPageRouter.js").MenuPageRouter,
   *   onAuthenticated: () => void,
   * }} deps
   */
  constructor(deps) {
    super("Auth", deps.store);
    this.authManager = deps.authManager;
    this.router = deps.router;
    this.onAuthenticated = deps.onAuthenticated;
  }

  activate(_pageName, _params) {
    return this.index();
  }

  index() {
    const app = document.getElementById("app");
    if (!app) return;
    const vm = new LoginViewModel({
      authManager: this.authManager,
      store: this.store,
      onAuthenticated: this.onAuthenticated,
    });
    vm.mount(app);
  }
}

class LoginViewModel extends AbstractViewModel {
  /**
   * @param {{
   *   authManager: import("../managers/AuthManager.js").AuthManager,
   *   store: import("../store/Store.js").Store,
   *   onAuthenticated: () => void,
   * }} deps
   */
  constructor(deps) {
    super();
    this.authManager = deps.authManager;
    this.store = deps.store;
    this.onAuthenticated = deps.onAuthenticated;
    this.submitting = false;
  }

  render() {
    const defaultGuildId = this.store.config.defaultGuildId ?? "";
    return `
      <div class="sg-login">
        <form id="login-form" class="sg-login__card" autocomplete="off">
          <div class="sg-login__header">
            <div class="sg-login__brand">
              <img src="${structsLogoUrl}" alt="" />
              <span class="sg-login__brand-name">STRUCTS</span>
            </div>
            <div class="sg-login__tagline">Guild Operator Console</div>
          </div>
          <div class="sg-login__body">
            <div class="mb-3">
              <label class="form-label" for="guild-id">Guild ID</label>
              <input id="guild-id" name="guild_id" type="text" class="form-control" value="${escapeAttr(defaultGuildId)}" placeholder="e.g. 0-2" required />
              <div class="invalid-feedback"></div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="mnemonic">Mnemonic (12 or 24 words)</label>
              <textarea id="mnemonic" name="mnemonic" class="form-control font-monospace" rows="3" placeholder="word1 word2 word3..." required autocomplete="off" spellcheck="false"></textarea>
              <div class="invalid-feedback"></div>
              <div class="form-text text-warning"><i class="bi bi-shield-lock me-1"></i>Stored in sessionStorage only. Cleared when the tab closes.</div>
            </div>
            <button type="submit" class="btn btn-primary w-100" ${this.submitting ? "disabled" : ""}>
              ${this.submitting ? '<span class="spinner-border spinner-border-sm me-2"></span>' : ""}Sign in
            </button>
          </div>
        </form>
      </div>
    `;
  }

  bind() {
    const form = /** @type {HTMLFormElement | null} */ (document.getElementById("login-form"));
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (this.submitting) return;
      const values = readFormValues(form);
      const { valid, errors } = validateForm(
        { guild_id: [required(), isGuildId], mnemonic: [required(), isMnemonic] },
        values,
      );
      if (!valid) {
        notify.formError("login-form", errors);
        return;
      }
      this.submitting = true;
      this.update();
      try {
        await this.authManager.login(values.mnemonic.trim(), values.guild_id.trim());
        this.onAuthenticated();
      } catch (err) {
        console.error("[LoginViewModel] sign-in failed", err);
        notify.fromError(err instanceof Error ? err : new Error(String(err)));
        this.submitting = false;
        this.update();
      }
    });
  }
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
