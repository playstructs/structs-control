import * as bsModal from "bootstrap/js/dist/modal.js";
import { ENERGY_PERMISSION_COLUMNS } from "../constants/Permissions.js";

/**
 * Figma Set Permissions modal — pick bits, apply to selected players.
 *
 * @param {{
 *   playerCount: number,
 *   initialMask?: number,
 * }} options
 * @returns {Promise<number | null>} selected mask, or null if cancelled
 */
export function promptSetPermissions(options) {
  return new Promise((resolve) => {
    const layer = document.getElementById("notification-layer");
    if (!layer) {
      resolve(Number(options.initialMask) || 0);
      return;
    }

    const id = `sg-set-perms-${Date.now()}`;
    let mask = Number(options.initialMask) || 0;

    const renderChecks = () =>
      ENERGY_PERMISSION_COLUMNS.map((col) => {
        const checked = (mask & col.bit) === col.bit;
        return `
          <label class="sg-set-perms__check">
            <input type="checkbox" data-bit="${col.bit}" ${checked ? "checked" : ""} />
            <span>${escapeHtml(col.label)}</span>
          </label>`;
      }).join("");

    layer.insertAdjacentHTML(
      "beforeend",
      `<div id="${id}" class="modal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content sg-set-perms">
            <div class="modal-header">
              <h5 class="modal-title">Set Permissions</h5>
              <button type="button" class="btn-close" data-action="cancel" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="sg-set-perms__lead">
                Choose permissions to set for <strong>${options.playerCount}</strong>
                selected player${options.playerCount === 1 ? "" : "s"}.
              </p>
              <div class="sg-set-perms__grid" data-role="checks">${renderChecks()}</div>
            </div>
            <div class="modal-footer">
              <button type="button" class="sg-btn-lunar" data-action="cancel">Cancel</button>
              <button type="button" class="sg-btn-space" data-action="confirm">Set Permissions</button>
            </div>
          </div>
        </div>
      </div>`,
    );

    const el = document.getElementById(id);
    if (!el) {
      resolve(null);
      return;
    }

    const ModalCtor = /** @type {any} */ (bsModal).default ?? bsModal;
    const modal = new ModalCtor(el);

    el.querySelector('[data-role="checks"]')?.addEventListener("change", (e) => {
      const input = /** @type {HTMLInputElement} */ (e.target);
      if (!input.matches('input[type="checkbox"][data-bit]')) return;
      const bit = Number(input.getAttribute("data-bit"));
      mask = input.checked ? mask | bit : mask & ~bit;
    });

    const cleanup = (result) => {
      modal.hide();
      el.addEventListener("hidden.bs.modal", () => el.remove(), { once: true });
      resolve(result);
    };

    el.querySelectorAll('[data-action="confirm"]').forEach((b) => b.addEventListener("click", () => cleanup(mask)));
    el.querySelectorAll('[data-action="cancel"]').forEach((b) => b.addEventListener("click", () => cleanup(null)));
    modal.show();
  });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
