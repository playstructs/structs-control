import { AbstractViewModelComponent } from "../../framework/AbstractViewModelComponent.js";

/**
 * Renders a Resource in the right state. Pages use it like:
 *
 *   ${ResourceView.render(resource, {
 *     success: (data) => `<div>${data.name}</div>`,
 *     empty:   () => "<div class='sg-empty'>No data</div>",
 *   })}
 *
 * If `empty` is omitted and data is null/undefined/empty array, success() is
 * still called -- pages can choose to render their own empty inline. Use the
 * `empty` callback when you want a special path for "endpoint OK but no rows".
 */
export class ResourceView extends AbstractViewModelComponent {
  /**
   * @template T
   * @param {import("../../store/Resource.js").Resource<T>} resource
   * @param {{
   *   success: (data: T) => string,
   *   loading?: () => string,
   *   error?: (err: Error) => string,
   *   missing?: () => string,
   *   empty?: (data: T) => string | null,
   * }} cb
   * @returns {string}
   */
  static render(resource, cb) {
    switch (resource.status) {
      case "loading":
        return cb.loading?.() ?? '<div class="sg-loading"><div class="spinner-border text-primary"></div></div>';
      case "error":
        return (
          cb.error?.(resource.error ?? new Error("Unknown error")) ??
          `<div class="sg-error">${escapeHtml(resource.error?.message ?? "Something went wrong")}</div>`
        );
      case "missing":
        return (
          cb.missing?.() ??
          '<div class="sg-empty"><div class="sg-empty__title">Endpoint not available</div><div class="sg-empty__hint">This Guild API doesn\'t expose this resource yet.</div></div>'
        );
      case "success": {
        const empty = cb.empty?.(/** @type {any} */ (resource.data));
        if (empty != null) return empty;
        return cb.success(/** @type {any} */ (resource.data));
      }
      case "idle":
      default:
        return cb.loading?.() ?? '<div class="sg-loading"></div>';
    }
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
