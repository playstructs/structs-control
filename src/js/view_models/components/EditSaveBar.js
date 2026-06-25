/**
 * Floating save / cancel bar — Figma bottom-edit-bar (node 1:9942).
 *
 * @param {{ id?: string, message?: string }} [props]
 * @returns {string}
 */
export function editSaveBar(props = {}) {
  const id = props.id ?? "edit-save-bar";
  const message = props.message ?? "You've made changes. Don't forget to save!";
  return `<div class="sg-edit-save-bar" id="${escapeAttr(id)}" role="region" aria-label="Unsaved changes" aria-hidden="true">
      <p class="sg-edit-save-bar__message">${escapeHtml(message)}</p>
      <div class="sg-edit-save-bar__actions">
        <button type="button" class="sg-edit-save-bar__btn sg-edit-save-bar__btn--save" data-role="edit-save">Save</button>
        <button type="button" class="sg-edit-save-bar__btn sg-edit-save-bar__btn--cancel" data-role="edit-cancel">Cancel</button>
      </div>
    </div>`;
}

/** @param {HTMLElement | null | undefined} bar */
export function showEditSaveBar(bar) {
  if (!bar) return;
  if (bar.classList.contains("is-visible")) return;
  bar.setAttribute("aria-hidden", "false");
  document.body.classList.add("sg-has-edit-save-bar");
  requestAnimationFrame(() => {
    bar.classList.add("is-visible");
  });
}

/** @param {HTMLElement | null | undefined} bar */
export function hideEditSaveBar(bar) {
  if (!bar) return;
  bar.classList.remove("is-visible");
  bar.setAttribute("aria-hidden", "true");
  document.body.classList.remove("sg-has-edit-save-bar");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}
