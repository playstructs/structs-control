import { GuildAPIError } from "../errors/GuildAPIError.js";

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

function ensureToastLayer() {
  let layer = document.getElementById(TOAST_LAYER_ID);
  if (layer) {
    layer.classList.add("sg-toast-stack");
    return layer;
  }
  layer = document.createElement("div");
  layer.id = TOAST_LAYER_ID;
  layer.className = "sg-toast-stack";
  document.body.appendChild(layer);
  return layer;
}

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
 * @param {{
 *   timeoutMs?: number,
 *   href?: string,
 *   onNavigate?: (path: string) => void,
 * }} [options]
 */
function toast(message, level = "info", options = {}) {
  const layer = ensureToastLayer();
  const id = `sg-toast-${++toastSeq}`;
  const clickable = Boolean(options.href);
  const html = `
    <div id="${id}" class="toast align-items-center ${levelToBootstrapBg(level)} border-0 show${clickable ? " sg-toast--action" : ""}" role="alert" aria-live="polite" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}${clickable ? ' <span class="sg-toast__hint">View details</span>' : ""}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;
  layer.insertAdjacentHTML("beforeend", html);
  wireToastEl(document.getElementById(id), options);
}

/**
 * Figma success alert — white card, green check, clickable to completed.
 *
 * @param {string} message
 * @param {{
 *   timeoutMs?: number,
 *   href?: string,
 *   onNavigate?: (path: string) => void,
 * }} [options]
 */
function successToast(message, options = {}) {
  const layer = ensureToastLayer();
  const id = `sg-toast-${++toastSeq}`;
  const clickable = Boolean(options.href);
  const html = `
    <div id="${id}" class="sg-success-toast${clickable ? " sg-toast--action" : ""}" role="alert" aria-live="polite" aria-atomic="true">
      <span class="sg-success-toast__icon" aria-hidden="true"><i class="bi bi-check-circle-fill"></i></span>
      <div class="sg-success-toast__body">
        <p class="sg-success-toast__title">${escapeHtml(message)}</p>
        ${clickable ? '<p class="sg-success-toast__hint">View details</p>' : ""}
      </div>
      <button type="button" class="sg-success-toast__close" data-bs-dismiss="toast" aria-label="Close">
        <i class="bi bi-x" aria-hidden="true"></i>
      </button>
    </div>
  `;
  layer.insertAdjacentHTML("beforeend", html);
  wireToastEl(document.getElementById(id), options);
}

/**
 * @param {HTMLElement | null} el
 * @param {{
 *   timeoutMs?: number,
 *   href?: string,
 *   onNavigate?: (path: string) => void,
 * }} options
 */
function wireToastEl(el, options) {
  if (!el) return;
  const remove = () => el.remove();
  el.querySelector('[data-bs-dismiss="toast"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    remove();
  });
  if (options.href) {
    const href = options.href;
    el.style.cursor = "pointer";
    el.addEventListener("click", (e) => {
      if (e.target instanceof Element && e.target.closest('[data-bs-dismiss="toast"]')) return;
      remove();
      if (options.onNavigate) options.onNavigate(href);
      else window.history.pushState({}, "", href);
    });
  }
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
  let message = "Something went wrong.";
  if (err instanceof GuildAPIError) {
    message = err.errors?.[0] || err.message || message;
    if (err.url) message = `${message} (${err.url})`;
  } else if (err && typeof err === "object" && "errors" in err && Array.isArray(err.errors) && err.errors.length) {
    message = String(err.errors[0]);
  } else if (err instanceof Error && err.message) {
    message = err.message;
  }
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
  successToast,
  banner,
  dismissBanner,
  formError,
  fromError,
};
