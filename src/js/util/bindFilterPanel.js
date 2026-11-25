import {
  filterBoundInputHint,
  formatFilterBoundForInput,
  parseFilterBoundInput,
} from "./filterUnits.js";
import * as bsOffcanvas from "bootstrap/js/dist/offcanvas.js";

/**
 * Wire FilterPanel offcanvas: accordion toggles, draft state, Apply / Clear.
 *
 * @typedef {import("./tableFilters.js").FilterField} FilterField
 * @typedef {import("./tableFilters.js").FilterState} FilterState
 */

/**
 * @param {HTMLElement} root
 * @param {FilterField[]} schema
 * @param {FilterState} appliedFilters
 * @param {{ onApply: (filters: FilterState) => void }} handlers
 */
export function bindFilterPanel(root, schema, appliedFilters, handlers) {
  mountFilterOffcanvasToBody(root);

  /** @type {Set<string>} */
  const expanded = new Set(
    schema.filter((f) => {
      const s = appliedFilters[f.id];
      if (!s) return false;
      if (f.type === "checkbox") return /** @type {string[]} */ (s).length > 0;
      const r = /** @type {{ min?: number, max?: number }} */ (s);
      return r.min != null || r.max != null;
    }).map((f) => f.id),
  );

  root.querySelectorAll("[data-role='toggle-section']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = /** @type {HTMLElement} */ (btn).closest("[data-section]");
      const fieldId = section?.getAttribute("data-section");
      if (!fieldId) return;

      const field = schema.find((f) => f.id === fieldId);
      if (!field) return;

      if (expanded.has(fieldId)) {
        expanded.delete(fieldId);
        section?.querySelector(".sg-filter-panel__section-body")?.remove();
        btn.setAttribute("aria-expanded", "false");
        const icon = btn.querySelector(".sg-filter-panel__section-icon");
        if (icon) icon.className = "bi bi-plus-square-fill sg-filter-panel__section-icon";
      } else {
        expanded.add(fieldId);
        btn.setAttribute("aria-expanded", "true");
        const icon = btn.querySelector(".sg-filter-panel__section-icon");
        if (icon) icon.className = "bi bi-dash-square-fill sg-filter-panel__section-icon";
        const body = document.createElement("div");
        body.className = "sg-filter-panel__section-body";
        body.innerHTML = renderSectionBodyHtml(field, appliedFilters, `${root.id}-${fieldId}`);
        section?.appendChild(body);
      }
    });
  });

  root.querySelector('[data-role="panel-apply"]')?.addEventListener("click", () => {
    const next = readDraftFilters(root, schema);
    // Dismiss before navigation/re-render so Bootstrap's backdrop is not orphaned.
    dismissFilterOffcanvas(root);
    handlers.onApply(next);
  });

  root.querySelector('[data-role="panel-clear"]')?.addEventListener("click", () => {
    clearDraftInputs(root, schema);
    dismissFilterOffcanvas(root);
    handlers.onApply({});
  });
}

/**
 * @param {HTMLElement} root
 * @param {FilterField[]} schema
 * @returns {FilterState}
 */
function readDraftFilters(root, schema) {
  /** @type {FilterState} */
  const filters = {};

  for (const field of schema) {
    if (field.type === "checkbox") {
      const values = [...root.querySelectorAll(`[data-role="checkbox"][data-field="${field.id}"]:checked`)].map(
        (el) => /** @type {HTMLInputElement} */ (el).value,
      );
      if (values.length) filters[field.id] = values;
      continue;
    }

    const minEl = /** @type {HTMLInputElement | null} */ (
      root.querySelector(`[data-role="range-min"][data-field="${field.id}"]`)
    );
    const maxEl = /** @type {HTMLInputElement | null} */ (
      root.querySelector(`[data-role="range-max"][data-field="${field.id}"]`)
    );
    const min = minEl?.value.trim();
    const max = maxEl?.value.trim();
    const minVal = min ? parseFilterBoundInput(min, field.denom) : null;
    const maxVal = max ? parseFilterBoundInput(max, field.denom) : null;
    if (minVal != null || maxVal != null) {
      filters[field.id] = {
        ...(minVal != null ? { min: minVal } : {}),
        ...(maxVal != null ? { max: maxVal } : {}),
      };
    }
  }

  return filters;
}

/**
 * @param {HTMLElement} root
 * @param {FilterField[]} schema
 */
function clearDraftInputs(root, schema) {
  for (const field of schema) {
    if (field.type === "checkbox") {
      root.querySelectorAll(`[data-role="checkbox"][data-field="${field.id}"]`).forEach((el) => {
        /** @type {HTMLInputElement} */ (el).checked = false;
      });
    } else {
      const minEl = /** @type {HTMLInputElement | null} */ (
        root.querySelector(`[data-role="range-min"][data-field="${field.id}"]`)
      );
      const maxEl = /** @type {HTMLInputElement | null} */ (
        root.querySelector(`[data-role="range-max"][data-field="${field.id}"]`)
      );
      if (minEl) minEl.value = "";
      if (maxEl) maxEl.value = "";
    }
  }
}

/**
 * @param {FilterField} field
 * @param {FilterState} filters
 * @param {string} sectionId
 */
function renderSectionBodyHtml(field, filters, sectionId) {
  if (field.type === "checkbox") {
    const selected = new Set(/** @type {string[]} */ (filters[field.id] ?? []));
    const half = Math.ceil(field.options.length / 2);
    const col1 = field.options.slice(0, half);
    const col2 = field.options.slice(half);
    const renderCol = (opts) =>
      opts
        .map((opt) => {
          const inputId = `${sectionId}-${opt.value}`;
          const checked = selected.has(opt.value) ? "checked" : "";
          return `<label class="sg-filter-panel__check" for="${inputId}"><input type="checkbox" class="form-check-input" id="${inputId}" data-role="checkbox" data-field="${field.id}" value="${opt.value}" ${checked} /><span>${opt.label}</span></label>`;
        })
        .join("");
    return `<div class="sg-filter-panel__checkbox-grid"><div class="sg-filter-panel__checkbox-col">${renderCol(col1)}</div><div class="sg-filter-panel__checkbox-col">${renderCol(col2)}</div></div>`;
  }

  const range = /** @type {{ min?: number, max?: number }} */ (filters[field.id] ?? {});
  const unit = filterBoundInputHint(field.denom);
  const minLabel = unit ? `Min (${unit})` : "Min";
  const maxLabel = unit ? `Max (${unit})` : "Max";
  const minValue = formatFilterBoundForInput(range.min, field.denom);
  const maxValue = formatFilterBoundForInput(range.max, field.denom);
  return `<div class="sg-filter-panel__range-row"><div class="sg-filter-panel__range-field"><label class="sg-filter-panel__range-label" for="${sectionId}-min">${minLabel}</label><input type="text" inputmode="decimal" class="form-control form-control-sm sg-filter-panel__range-input" id="${sectionId}-min" data-role="range-min" data-field="${field.id}" value="${minValue}" placeholder="${unit || "0"}" /></div><div class="sg-filter-panel__range-field"><label class="sg-filter-panel__range-label" for="${sectionId}-max">${maxLabel}</label><input type="text" inputmode="decimal" class="form-control form-control-sm sg-filter-panel__range-input" id="${sectionId}-max" data-role="range-max" data-field="${field.id}" value="${maxValue}" placeholder="${unit || "0"}" /></div></div>`;
}

function getOffcanvasCtor() {
  return /** @type {any} */ (bsOffcanvas).default ?? bsOffcanvas;
}

/**
 * Tear down an offcanvas immediately (no hide animation).
 * Apply/Clear navigate/re-render the table; calling hide() would queue a
 * transition callback that touches classList after the panel is gone.
 * @param {HTMLElement | null | undefined} panel
 */
export function dismissFilterOffcanvas(panel) {
  const Offcanvas = getOffcanvasCtor();
  if (Offcanvas && panel) {
    const instance = Offcanvas.getInstance(panel);
    if (instance) {
      try {
        instance.dispose();
      } catch {
        /* already torn down */
      }
    }
    panel.classList.remove("show", "showing", "hiding");
    panel.removeAttribute("aria-modal");
    panel.removeAttribute("role");
    panel.setAttribute("aria-hidden", "true");
  }
  document.querySelectorAll(".offcanvas-backdrop").forEach((el) => el.remove());
  document.body.classList.remove("overflow-hidden");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("padding-right");
}

/**
 * Bootstrap appends the backdrop to the offcanvas parent. Keep the panel on
 * `body` so fixed positioning and full-viewport width are not clipped.
 *
 * @param {HTMLElement} panel
 */
function mountFilterOffcanvasToBody(panel) {
  if (!panel || panel.parentElement === document.body) return;
  document.body.appendChild(panel);
}
