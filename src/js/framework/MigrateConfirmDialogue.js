import * as bsModal from "bootstrap/js/dist/modal.js";

/**
 * Figma modal-message confirmation for bulk player migration.
 *
 * @param {{
 *   playerCount: number,
 *   playerNames: string[],
 *   destName: string,
 * }} options
 * @returns {Promise<boolean>}
 */
export function confirmMigrate(options) {
  return new Promise((resolve) => {
    const layer = document.getElementById("notification-layer");
    if (!layer) {
      resolve(window.confirm(`Migrate ${options.playerCount} player(s) to ${options.destName}?`));
      return;
    }

    const id = `sg-migrate-confirm-${Date.now()}`;
    const names = options.playerNames.slice();
    const pageSize = 8;
    let page = 1;
    let listOpen = false;

    const renderList = () => {
      const totalPages = Math.max(1, Math.ceil(names.length / pageSize));
      page = Math.min(page, totalPages);
      const start = (page - 1) * pageSize;
      const slice = names.slice(start, start + pageSize);
      const mid = Math.ceil(slice.length / 2);
      const col1 = slice.slice(0, mid);
      const col2 = slice.slice(mid);
      const colHtml = (items) => items.map((n) => `<p class="sg-migrate-confirm__name">${escapeHtml(n)}</p>`).join("");
      return `
        <div class="sg-migrate-confirm__list${listOpen ? " is-open" : ""}">
          <button type="button" class="sg-migrate-confirm__list-toggle" data-action="toggle-list">View List</button>
          <div class="sg-migrate-confirm__list-body">
            <div class="sg-migrate-confirm__list-cols">
              <div>${colHtml(col1)}</div>
              <div>${colHtml(col2)}</div>
            </div>
            <div class="sg-migrate-confirm__list-pager">
              <span>${page} of ${totalPages} page${totalPages === 1 ? "" : "s"}</span>
              <button type="button" class="sg-migrate-confirm__page-btn" data-action="prev" ${page <= 1 ? "disabled" : ""}>Prev</button>
              <button type="button" class="sg-migrate-confirm__page-btn" data-action="next" ${page >= totalPages ? "disabled" : ""}>Next</button>
            </div>
          </div>
        </div>`;
    };

    const renderBody = () => `
      <div class="sg-migrate-confirm">
        <div class="sg-migrate-confirm__icon" aria-hidden="true"><i class="bi bi-exclamation-triangle-fill"></i></div>
        <h5 class="sg-migrate-confirm__title">Are you sure?</h5>
        <p class="sg-migrate-confirm__lead">
          Do you want to migrate <strong>${options.playerCount} Player${options.playerCount === 1 ? "" : "s"}</strong>
          to <strong>${escapeHtml(options.destName)}</strong>?
        </p>
        <div class="sg-migrate-confirm__name-field">
          <label class="form-label" for="${id}-name">Name</label>
          <input type="text" class="form-control" id="${id}-name" data-role="confirm-name" value="${escapeAttr(options.destName)}" autocomplete="off" />
        </div>
        ${renderList()}
      </div>`;

    layer.insertAdjacentHTML(
      "beforeend",
      `<div id="${id}" class="modal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered sg-migrate-confirm__dialog">
          <div class="modal-content sg-migrate-confirm__content">
            <div class="modal-body" data-role="body">${renderBody()}</div>
            <div class="modal-footer sg-migrate-confirm__footer">
              <button type="button" class="sg-btn-lunar" data-action="cancel">Cancel</button>
              <button type="button" class="sg-btn-space" data-action="confirm">OK</button>
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
    const body = /** @type {HTMLElement} */ (el.querySelector('[data-role="body"]'));
    const nameInput = /** @type {HTMLInputElement} */ (el.querySelector('[data-role="confirm-name"]'));
    const confirmBtn = /** @type {HTMLButtonElement | null} */ (el.querySelector('[data-action="confirm"]'));

    const syncConfirm = () => {
      if (!confirmBtn || !nameInput) return;
      const typed = nameInput.value.trim();
      confirmBtn.disabled = typed !== String(options.destName).trim();
    };

    const cleanup = (result) => {
      modal.hide();
      el.addEventListener("hidden.bs.modal", () => el.remove(), { once: true });
      resolve(result);
    };

    const rebind = () => {
      if (!body) return;
      body.innerHTML = renderBody();
      body.querySelector('[data-role="confirm-name"]')?.addEventListener("input", syncConfirm);
      body.querySelector('[data-action="toggle-list"]')?.addEventListener("click", () => {
        listOpen = !listOpen;
        rebind();
      });
      body.querySelector('[data-action="prev"]')?.addEventListener("click", () => {
        page = Math.max(1, page - 1);
        rebind();
      });
      body.querySelector('[data-action="next"]')?.addEventListener("click", () => {
        page += 1;
        rebind();
      });
      syncConfirm();
    };

    rebind();

    el.querySelectorAll('[data-action="confirm"]').forEach((b) => b.addEventListener("click", () => cleanup(true)));
    el.querySelectorAll('[data-action="cancel"]').forEach((b) => b.addEventListener("click", () => cleanup(false)));

    modal.show();
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}
