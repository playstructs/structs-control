/**
 * Unified UI notification surface. Three channels:
 *
 *   notify.toast(msg, level)        ephemeral bottom-right
 *   notify.banner(msg, level)       persistent top, dismissible
 *   notify.formError(formId, map)   maps { field: message } to .invalid-feedback
 *
 * Level is one of: "info" | "success" | "warning" | "danger".
 *
 * These are global (not per-view-model) on purpose: errors thrown anywhere in
 * the app reach the same surfaces.
 */

const TOAST_LAYER_ID = "toast-layer";
const BANNER_LAYER_ID = "banner-layer";

/** @typedef {"info" | "success" | "warning" | "danger"} NotifyLevel */

let toastSeq = 0;

function levelToBootstrapBg(level) {
  switch (level) {
    case "success":
      return "text-bg-success";
    case "warning":
      return "text-bg-warning";
    case "danger":
      return "text-bg-danger";
    default:
      return "text-bg-primary";
  }
}

/**
 * @param {string} message
 * @param {NotifyLevel} [level]
 * @param {{ timeoutMs?: number }} [options]
 */
function toast(message, level = "info", options = {}) {
  const layer = document.getElementById(TOAST_LAYER_ID);
  if (!layer) {
    console.warn("[notify.toast]", level, message);
    return;
  }
  const id = `sg-toast-${++toastSeq}`;
  const html = `
    <div id="${id}" class="toast align-items-center ${levelToBootstrapBg(level)} border-0 show" role="alert" aria-live="polite" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;
  layer.insertAdjacentHTML("beforeend", html);
  const el = document.getElementById(id);
  if (!el) return;
  const remove = () => el.remove();
  el.querySelector('[data-bs-dismiss="toast"]')?.addEventListener("click", remove);
  const timeout = options.timeoutMs ?? 4500;
  if (timeout > 0) setTimeout(remove, timeout);
}

/**
 * @param {string} message
 * @param {NotifyLevel} [level]
 * @param {{ id?: string, dismissible?: boolean }} [options]
 */
function banner(message, level = "info", options = {}) {
  const layer = document.getElementById(BANNER_LAYER_ID);
  if (!layer) {
    console.warn("[notify.banner]", level, message);
    return;
  }
  const id = options.id ?? `sg-banner-${++toastSeq}`;
  const existing = document.getElementById(id);
  if (existing) existing.remove();
  const dismissible = options.dismissible ?? true;
  const html = `
    <div id="${id}" class="alert alert-${level} ${dismissible ? "alert-dismissible" : ""} mb-0 rounded-0" role="alert">
      ${escapeHtml(message)}
      ${dismissible ? '<button type="button" class="btn-close" aria-label="Close"></button>' : ""}
    </div>
  `;
  layer.insertAdjacentHTML("beforeend", html);
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector(".btn-close")?.addEventListener("click", () => el.remove());
}

function dismissBanner(id) {
  document.getElementById(id)?.remove();
}

/**
 * Apply field errors to a form. Looks up inputs by `name`, sets `.is-invalid`,
 * and writes the message to the sibling `.invalid-feedback`.
 *
 * @param {string} formId
 * @param {Record<string, string>} fieldErrors
 */
function formError(formId, fieldErrors) {
  const form = /** @type {HTMLFormElement | null} */ (document.getElementById(formId));
  if (!form) return;

  for (const el of form.querySelectorAll(".is-invalid")) el.classList.remove("is-invalid");
  for (const el of form.querySelectorAll(".invalid-feedback")) el.textContent = "";

  for (const [name, message] of Object.entries(fieldErrors)) {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) continue;
    input.classList.add("is-invalid");
    const feedback = input.parentElement?.querySelector(".invalid-feedback");
    if (feedback) feedback.textContent = message;
  }
}

/**
 * @param {Error} err
 */
function fromError(err) {
  const message =
    err && typeof err === "object" && "errors" in err && Array.isArray(err.errors) && err.errors.length
      ? String(err.errors[0])
      : err?.message || "Something went wrong.";
  toast(message, "danger");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const notify = {
  toast,
  banner,
  dismissBanner,
  formError,
  fromError,
};
