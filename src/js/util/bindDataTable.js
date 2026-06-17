import { FilterPanel } from "../view_models/components/FilterPanel.js";
import {
  clearFilterParams,
  hasActiveFilters,
  parseTableParams,
  removeFilterTag,
  serializeFiltersToParams,
} from "./tableFilters.js";

/**
 * URL-synced sort/search/pagination props for bindDataTable.
 *
 * @param {Record<string, unknown>} params
 * @param {string} [prefix]
 * @returns {{ sort?: string, q?: string, field?: string, page: number }}
 */
export function tableBindState(params, prefix = "") {
  const { sort, q, field, page } = parseTableParams(params, prefix);
  return { sort, q, field, page: page ?? 1 };
}

/**
 * Next sort direction when a column header is clicked.
 *
 * @param {boolean} isSortedColumn - Whether this column is the active sort column
 * @param {"asc" | "desc" | undefined} currentDir
 * @returns {"asc" | "desc"}
 */
export function nextSortDirection(isSortedColumn, currentDir) {
  return isSortedColumn && currentDir === "asc" ? "desc" : "asc";
}

/**
 * Wire sort, search, pagination, filter panel, row navigation, and filter-tag removal
 * for a rendered DataTable root element.
 *
 * @param {HTMLElement | Element | null | undefined} root
 * @param {import("../view_models/components/DataTable.js").DataTable["props"]} props
 * @param {{
 *   onChange: (next: Record<string, unknown>) => void,
 *   onNavigate?: (path: string) => void,
 *   onRemoveFilter?: (tagId: string) => void,
 *   onApplyFilters?: (filters: import("./tableFilters.js").FilterState) => void,
 * }} handlers
 */
/**
 * Move the filter offcanvas to <body> so it overlays the shell at viewport scale.
 *
 * @param {string} panelId
 * @returns {HTMLElement | null}
 */
function portalFilterPanel(panelId) {
  document.querySelectorAll(`body > #${CSS.escape(panelId)}`).forEach((el) => el.remove());
  const panelEl = document.getElementById(panelId);
  if (panelEl && panelEl.parentElement !== document.body) {
    document.body.appendChild(panelEl);
  }
  return panelEl;
}

export function bindDataTable(root, props, handlers) {
  if (!root) return;
  const { onChange, onNavigate, onRemoveFilter, onApplyFilters } = handlers;
  const prefix = props.paramPrefix ?? "";
  const page = Number(props.page) || 1;

  root.querySelectorAll("th[data-col]").forEach((th) => {
    th.addEventListener("click", () => {
      const id = th.getAttribute("data-col");
      if (!id || th.classList.contains("is-no-sort")) return;
      const isSortedColumn = th.classList.contains("is-sorted");
      const currentDir = th.classList.contains("is-sorted-desc")
        ? "desc"
        : th.classList.contains("is-sorted-asc")
          ? "asc"
          : undefined;
      const nextDir = nextSortDirection(isSortedColumn, currentDir);
      onChange({ [`${prefix}sort`]: `${id}:${nextDir}`, [`${prefix}page`]: 1 });
    });
  });

  const search = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-role="search"]'));
  const submitSearch = () => {
    if (search) onChange({ [`${prefix}q`]: search.value, [`${prefix}page`]: 1 });
  };

  if (search) {
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitSearch();
      }
    });
  }

  root.querySelector('[data-role="search-submit"]')?.addEventListener("click", submitSearch);

  root.querySelectorAll('[data-role="scope-option"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const fieldId = /** @type {HTMLElement} */ (btn).dataset.field;
      if (fieldId) onChange({ [`${prefix}field`]: fieldId, [`${prefix}page`]: 1 });
    });
  });

  root.querySelector('[data-role="prev"]')?.addEventListener("click", () => {
    onChange({ [`${prefix}page`]: Math.max(1, page - 1) });
  });
  root.querySelector('[data-role="next"]')?.addEventListener("click", () => {
    onChange({ [`${prefix}page`]: page + 1 });
  });

  root.querySelector('[data-role="clear-filters"]')?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (search) search.value = "";
    onChange({ [`${prefix}q`]: "", [`${prefix}field`]: "", [`${prefix}page`]: 1, filters: null });
  });

  root.querySelectorAll('[data-role="remove-filter"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const tagId = /** @type {HTMLElement} */ (btn).dataset.tagId;
      if (!tagId) return;
      if (onRemoveFilter) {
        onRemoveFilter(tagId);
        return;
      }
      const nextFilters = removeFilterTag(props.filters ?? {}, tagId);
      onChange({
        [`${prefix}page`]: 1,
        filters: hasActiveFilters(nextFilters) ? nextFilters : null,
      });
    });
  });

  const panelEl = portalFilterPanel(`${props.id}-filter-panel`);
  if (panelEl && props.filterSchema?.length) {
    const panel = new FilterPanel({
      id: `${props.id}-filter-panel`,
      schema: props.filterSchema,
      filters: props.filters ?? {},
    });
    panel.bind(/** @type {HTMLElement} */ (panelEl), {
      onApply: (filters) => {
        if (onApplyFilters) {
          onApplyFilters(filters);
          return;
        }
        const cleared = clearFilterParams({}, props.filterSchema, prefix);
        const serialized = serializeFiltersToParams(filters, props.filterSchema, prefix);
        onChange({ [`${prefix}page`]: 1, ...cleared, ...serialized, filters });
      },
    });
  }

  if (onNavigate) {
    root.querySelectorAll(".sg-row-link").forEach((tr) => {
      tr.addEventListener("click", () => {
        const href = tr.getAttribute("data-href");
        if (href) onNavigate(href);
      });
    });
  }
}

/**
 * Merge URL query params and navigate — shared by list pages using DataTable.
 *
 * @param {import("../framework/MenuPageRouter.js").MenuPageRouter} router
 * @param {string} basePath
 * @param {Record<string, unknown>} params
 * @param {Record<string, unknown>} next
 * @param {import("./tableFilters.js").FilterField[]} [filterSchema]
 * @param {string} [prefix]
 */
export function gotoTableState(router, basePath, params, next, filterSchema, prefix = "") {
  let merged = { ...params, ...next };
  delete merged.filters;

  const qKey = `${prefix}q`;
  const sortKey = `${prefix}sort`;
  const pageKey = `${prefix}page`;
  const fieldKey = `${prefix}field`;
  const fKey = `${prefix}f`;

  if (!merged[qKey]) delete merged[qKey];
  if (!merged[sortKey]) delete merged[sortKey];
  if (merged[pageKey] === 1 || merged[pageKey] === "1") delete merged[pageKey];
  if (!merged[fieldKey]) delete merged[fieldKey];

  if (next.filters === null) {
    merged = clearFilterParams(merged, filterSchema, prefix);
  } else if (next.filters && typeof next.filters === "object") {
    merged = {
      ...clearFilterParams(merged, filterSchema, prefix),
      ...serializeFiltersToParams(/** @type {any} */ (next.filters), filterSchema, prefix),
    };
  }

  if (merged[fKey] === "") delete merged[fKey];
  if (filterSchema) {
    for (const field of filterSchema) {
      if (field.type === "range") {
        const minKey = `${prefix}${field.id}.min`;
        const maxKey = `${prefix}${field.id}.max`;
        if (merged[minKey] === "" || merged[minKey] == null) delete merged[minKey];
        if (merged[maxKey] === "" || merged[maxKey] == null) delete merged[maxKey];
      }
    }
  }

  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(merged)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => [k, String(v)]),
    ),
  ).toString();
  router.goto(basePath + (qs ? `?${qs}` : ""));
}

/**
 * Build the query string for a table state transition (test helper / preview).
 *
 * @param {Record<string, unknown>} params
 * @param {Record<string, unknown>} next
 * @param {import("./tableFilters.js").FilterField[]} [filterSchema]
 * @param {string} [prefix]
 * @returns {string}
 */
export function buildTableQuery(params, next, filterSchema, prefix = "") {
  /** @type {{ goto: (path: string) => void, path: string }} */
  const capture = { path: "", goto(p) { this.path = p; } };
  gotoTableState(capture, "/", params, next, filterSchema, prefix);
  const idx = capture.path.indexOf("?");
  return idx >= 0 ? capture.path.slice(idx + 1) : "";
}
