import { entityRoute, isEntityId } from "./entityId.js";
import { entityLabel } from "./entityLookup.js";

/**
 * @typedef {import("./entityLookup.js").EntityLookup} EntityLookup
 * @typedef {{ className?: string, monospace?: boolean, title?: string }} EntityLinkOptions
 */

/**
 * @param {unknown} value
 * @param {EntityLookup | null | undefined} lookup
 * @param {EntityLinkOptions} [options]
 * @returns {string} safe HTML
 */
export function renderEntityLink(value, lookup, options = {}) {
  if (value == null || value === "" || value === "—") {
    return `<span class="text-secondary">—</span>`;
  }

  const id = String(value).trim();
  if (!isEntityId(id)) {
    return `<span class="${classNames(options)}">${escapeHtml(id)}</span>`;
  }

  const label = entityLabel(id, lookup);
  const href = entityRoute(id);
  const cls = classNames(options);
  const title = options.title ?? id;

  if (!href) {
    return `<span class="${cls}" title="${escapeAttr(title)}">${escapeHtml(label)}</span>`;
  }

  return `<a href="${escapeAttr(href)}" class="${cls} sg-entity-link" data-spa-link title="${escapeAttr(title)}">${escapeHtml(label)}</a>`;
}

/**
 * Alias for table cells — auto-detects entity ids in arbitrary column values.
 * @param {unknown} value
 * @param {EntityLookup | null | undefined} lookup
 * @param {EntityLinkOptions} [options]
 * @returns {string}
 */
export function renderEntityRef(value, lookup, options = {}) {
  return renderEntityLink(value, lookup, { monospace: true, ...options });
}

/**
 * @param {EntityLinkOptions} options
 */
function classNames(options) {
  const parts = [];
  if (options.monospace !== false) parts.push("sg-datatable__cell-mono");
  if (options.className) parts.push(options.className);
  return parts.join(" ") || "sg-entity-link-text";
}

function escapeAttr(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
