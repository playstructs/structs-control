import { AbstractViewModelComponent } from "../../framework/AbstractViewModelComponent.js";
import { bindFilterPanel } from "../../util/bindFilterPanel.js";
import { filterBoundInputHint, formatFilterBoundForInput } from "../../util/filterUnits.js";

/**
 * Figma filter sidebar — 560px offcanvas with accordion sections.
 *
 * @typedef {import("../../util/tableFilters.js").FilterField} FilterField
 * @typedef {import("../../util/tableFilters.js").FilterState} FilterState
 */
export class FilterPanel extends AbstractViewModelComponent {
  /**
   * @param {{
   *   id: string,
   *   schema: FilterField[],
   *   filters?: FilterState,
   * }} props
   */
  constructor(props) {
    super();
    this.props = props;
  }

  renderHTML() {
    const { id, schema, filters = {} } = this.props;

    const sections = schema
      .map((field) => {
        const sectionId = `${id}-${field.id}`;
        const expanded = isSectionActive(field, filters);
        const toggleIcon = expanded ? "bi-dash-square-fill" : "bi-plus-square-fill";
        const body = expanded ? renderSectionBody(field, filters, sectionId) : "";

        return `
          <div class="sg-filter-panel__section" data-section="${escapeAttr(field.id)}">
            <button type="button" class="sg-filter-panel__section-head" data-role="toggle-section" aria-expanded="${expanded}">
              <span class="sg-filter-panel__section-title">${escapeHtml(field.label)}</span>
              <i class="bi ${toggleIcon} sg-filter-panel__section-icon"></i>
            </button>
            ${body ? `<div class="sg-filter-panel__section-body">${body}</div>` : ""}
          </div>`;
      })
      .join("");

    return `
      <div class="offcanvas offcanvas-end sg-filter-panel" tabindex="-1" id="${escapeAttr(id)}" data-component="FilterPanel" aria-labelledby="${escapeAttr(id)}-label">
        <div class="sg-filter-panel__header">
          <h2 class="sg-filter-panel__title" id="${escapeAttr(id)}-label">Filters</h2>
          <button type="button" class="sg-filter-panel__close" data-bs-dismiss="offcanvas" aria-label="Close filters">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="sg-filter-panel__content">
          ${sections}
        </div>
        <div class="sg-filter-panel__footer">
          <button type="button" class="sg-filter-panel__clear-btn" data-role="panel-clear">Clear All</button>
          <button type="button" class="sg-btn-success-fill" data-role="panel-apply">Apply</button>
        </div>
      </div>`;
  }

  /**
   * @param {HTMLElement} root
   * @param {{ onApply: (filters: FilterState) => void }} handlers
   */
  // @ts-ignore
  bind(root, handlers) {
    if (!root || !handlers) return;
    bindFilterPanel(root, this.props.schema, this.props.filters ?? {}, handlers);
  }
}

/**
 * @param {import("../../util/tableFilters.js").FilterField} field
 * @param {import("../../util/tableFilters.js").FilterState} filters
 */
function isSectionActive(field, filters) {
  const state = filters[field.id];
  if (!state) return false;
  if (field.type === "checkbox") return /** @type {string[]} */ (state).length > 0;
  const range = /** @type {{ min?: number, max?: number }} */ (state);
  return range.min != null || range.max != null;
}

/**
 * @param {import("../../util/tableFilters.js").FilterField} field
 * @param {import("../../util/tableFilters.js").FilterState} filters
 * @param {string} sectionId
 */
function renderSectionBody(field, filters, sectionId) {
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
          return `
            <label class="sg-filter-panel__check" for="${escapeAttr(inputId)}">
              <input type="checkbox" class="form-check-input" id="${escapeAttr(inputId)}" data-role="checkbox" data-field="${escapeAttr(field.id)}" value="${escapeAttr(opt.value)}" ${checked} />
              <span>${escapeHtml(opt.label)}</span>
            </label>`;
        })
        .join("");

    return `<div class="sg-filter-panel__checkbox-grid"><div class="sg-filter-panel__checkbox-col">${renderCol(col1)}</div><div class="sg-filter-panel__checkbox-col">${renderCol(col2)}</div></div>`;
  }

  const range = /** @type {{ min?: number, max?: number }} */ (filters[field.id] ?? {});
  const unit = filterBoundInputHint(field.denom);
  const minLabel = unit ? `Min (${unit})` : "Min";
  const maxLabel = unit ? `Max (${unit})` : "Max";
  return `
    <div class="sg-filter-panel__range-row">
      <div class="sg-filter-panel__range-field">
        <label class="sg-filter-panel__range-label" for="${escapeAttr(sectionId)}-min">${minLabel}</label>
        <input type="text" inputmode="decimal" class="form-control form-control-sm sg-filter-panel__range-input" id="${escapeAttr(sectionId)}-min" data-role="range-min" data-field="${escapeAttr(field.id)}" value="${escapeAttr(formatFilterBoundForInput(range.min, field.denom))}" placeholder="${escapeAttr(unit || "0")}" />
      </div>
      <div class="sg-filter-panel__range-field">
        <label class="sg-filter-panel__range-label" for="${escapeAttr(sectionId)}-max">${maxLabel}</label>
        <input type="text" inputmode="decimal" class="form-control form-control-sm sg-filter-panel__range-input" id="${escapeAttr(sectionId)}-max" data-role="range-max" data-field="${escapeAttr(field.id)}" value="${escapeAttr(formatFilterBoundForInput(range.max, field.denom))}" placeholder="${escapeAttr(unit || "0")}" />
      </div>
    </div>`;
}

function escapeHtml(s) {
  if (s == null) return "";
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
