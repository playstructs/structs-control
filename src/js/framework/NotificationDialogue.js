import * as bsModal from "bootstrap/js/dist/modal.js";

/**
 * Modal-based confirmation dialogue. Uses Bootstrap's Modal a la carte.
 *
 * Usage:
 *   const ok = await NotificationDialogue.confirm({
 *     title: "Kick player?",
 *     body: "This will remove the player from the guild.",
 *     confirmLabel: "Kick",
 *     confirmVariant: "danger",
 *   });
 */
export const NotificationDialogue = {
  layerId: "notification-layer",

  /**
   * @param {{
   *   title: string,
   *   body: string,
   *   confirmLabel?: string,
   *   cancelLabel?: string,
   *   confirmVariant?: "primary" | "danger" | "success" | "warning",
   * }} options
   * @returns {Promise<boolean>}
   */
  confirm(options) {
    return new Promise((resolve) => {
      const layer = document.getElementById(this.layerId);
      if (!layer) {
        resolve(window.confirm(options.title + "\n\n" + options.body));
        return;
      }
      const id = `sg-confirm-${Date.now()}`;
      const variant = options.confirmVariant ?? "primary";
      layer.insertAdjacentHTML(
        "beforeend",
        `<div id="${id}" class="modal" tabindex="-1" data-bs-backdrop="static">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">${escapeHtml(options.title)}</h5>
                <button type="button" class="btn-close" data-action="cancel" aria-label="Close"></button>
              </div>
              <div class="modal-body">${escapeHtml(options.body)}</div>
              <div class="modal-footer">
                <button type="button" class="btn btn-light" data-action="cancel">${escapeHtml(options.cancelLabel ?? "Cancel")}</button>
                <button type="button" class="btn btn-${variant}" data-action="confirm">${escapeHtml(options.confirmLabel ?? "Confirm")}</button>
              </div>
            </div>
          </div>
        </div>`,
      );
      const el = document.getElementById(id);
      if (!el) {
        resolve(false);
        return;
      }
      const ModalCtor = /** @type {any} */ (bsModal).default ?? bsModal;
      const modal = new ModalCtor(el);

      const cleanup = (result) => {
        modal.hide();
        el.addEventListener("hidden.bs.modal", () => el.remove(), { once: true });
        resolve(result);
      };

      el.querySelectorAll('[data-action="confirm"]').forEach((b) =>
        b.addEventListener("click", () => cleanup(true)),
      );
      el.querySelectorAll('[data-action="cancel"]').forEach((b) =>
        b.addEventListener("click", () => cleanup(false)),
      );
      modal.show();
    });
  },
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
