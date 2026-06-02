import { AbstractViewModelComponent } from "../../framework/AbstractViewModelComponent.js";
import { bindDataTable } from "../../util/bindDataTable.js";

/**
 * Declarative table with client-side sort + filter + paging, all URL-synced via
 * `?sort=field:asc`, `?q=search`, `?page=2`. Layout matches the Figma Tables
 * frame: filter toolbar, scope + search cluster, 64px rows, footer pagination.
 *
 * Columns:
 *   { id, label, get(row), sort?, filter?, align?, render?(value, row) }
 */
export class DataTable extends AbstractViewModelComponent {
  /**
   * @param {{
   *   id: string,
   *   columns: Array<{
   *     id: string,
   *     label: string,
   *     get: (row: any) => any,
   *     sort?: (a: any, b: any) => number,
   *     filter?: (row: any, q: string) => boolean,
   *     align?: "start" | "center" | "end",
   *     render?: (value: any, row: any) => string,
   *   }>,
   *   rows: any[],
   *   keyFn?: (row: any) => string,
   *   onRowClick?: (row: any) => string,
   *   selectable?: boolean,
   *   sort?: string,
   *   q?: string,
   *   page?: number,
   *   pageSize?: number,
   *   emptyMessage?: string,
   *   searchScope?: string,
   *   filterTags?: Array<{ id: string, label: string }>,
   *   toolbarActionsHtml?: string,
   *   showFilterButton?: boolean,
   *   hideToolbar?: boolean,
   *   hideFooter?: boolean,
   *   hideSearch?: boolean,
   *   embedded?: boolean,
   * }} props
   */
  constructor(props) {
    super();
    this.props = props;
  }

  renderHTML() {
    const {
      id,
      columns,
      rows,
      sort,
      q,
      page,
      pageSize = 25,
      emptyMessage = "No results.",
      searchScope,
      filterTags = [],
      toolbarActionsHtml = "",
      showFilterButton = true,
      hideToolbar = false,
      hideFooter = false,
      hideSearch = false,
      embedded = false,
      selectable = false,
    } = this.props;

    const [sortField, sortDir] = (sort ?? "").split(":");
    const dir = sortDir === "desc" ? -1 : 1;

    let processed = rows.slice();
    const query = (q ?? "").trim().toLowerCase();
    if (query) {
      processed = processed.filter((row) =>
        columns.some((c) => (c.filter ? c.filter(row, query) : String(c.get(row) ?? "").toLowerCase().includes(query))),
      );
    }

    const col = sortField ? columns.find((c) => c.id === sortField) : null;
    if (col) {
      processed.sort((a, b) => {
        if (col.sort) return col.sort(a, b) * dir;
        const va = col.get(a);
        const vb = col.get(b);
        if (va == null && vb == null) return 0;
        if (va == null) return -1 * dir;
        if (vb == null) return 1 * dir;
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
        return String(va).localeCompare(String(vb)) * dir;
      });
    }

    const total = processed.length;
    const currentPage = Math.max(1, page ?? 1);
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    const start = (currentPage - 1) * pageSize;
    const pageRows = processed.slice(start, start + pageSize);
    const rangeStart = total === 0 ? 0 : start + 1;
    const rangeEnd = total === 0 ? 0 : Math.min(start + pageSize, total);
    const hasActiveFilters = Boolean(query || filterTags.length);

    const headers = columns
      .map((c) => {
        const isSorted = sortField === c.id;
        const sortable = c.sort !== undefined;
        const sortClass = sortable ? "is-sortable" : "is-no-sort";
        const sortedClass = isSorted ? `is-sorted is-sorted-${sortDir || "asc"}` : "";
        const align = c.align ? `text-${c.align}` : "";
        const sortIcon = sortable
          ? `<span class="sg-datatable__sort-icon"><i class="bi bi-${isSorted ? (sortDir === "desc" ? "chevron-down" : "chevron-up") : "chevron-expand"}"></i></span>`
          : "";
        return `<th data-col="${escapeAttr(c.id)}" class="${sortClass} ${sortedClass} ${align}">${escapeHtml(c.label)}${sortIcon}</th>`;
      })
      .join("");

    const checkHeader = selectable
      ? `<th class="sg-datatable__check-col"><input type="checkbox" class="form-check-input" data-role="select-all" aria-label="Select all rows" /></th>`
      : "";

    const tbody = pageRows.length
      ? pageRows
          .map((row) => {
            const path = this.props.onRowClick?.(row);
            const rowKey = this.props.keyFn?.(row) ?? "";
            const checkCell = selectable
              ? `<td class="sg-datatable__check-col"><input type="checkbox" class="form-check-input" data-role="row-select" data-key="${escapeHtml(rowKey)}" aria-label="Select row" /></td>`
              : "";
            const cells = columns
              .map((c) => {
                const value = c.get(row);
                const align = c.align ? `text-${c.align}` : "";
                const html = c.render ? c.render(value, row) : `<span class="sg-datatable__cell-label">${escapeHtml(value)}</span>`;
                return `<td class="${align}">${html}</td>`;
              })
              .join("");
            return `<tr data-key="${escapeHtml(rowKey)}" ${path ? `data-href="${escapeHtml(path)}"` : ""} class="${path ? "sg-row-link" : ""}">${checkCell}${cells}</tr>`;
          })
          .join("")
      : `<tr class="sg-datatable__empty-row"><td colspan="${columns.length + (selectable ? 1 : 0)}">${escapeHtml(emptyMessage)}</td></tr>`;

    const tagHtml = filterTags
      .map(
        (tag) =>
          `<span class="sg-datatable__tag">${escapeHtml(tag.label)}<button type="button" class="sg-datatable__tag-remove" data-role="remove-filter" data-tag-id="${escapeAttr(tag.id)}" aria-label="Remove filter"><i class="bi bi-x"></i></button></span>`,
      )
      .join("");

    const toolbar = hideToolbar
      ? ""
      : `
      <div class="sg-datatable__subheader">
        <div class="sg-datatable__subheader-left">
          <div class="sg-datatable__filter-controls">
            ${showFilterButton ? `<button type="button" class="sg-datatable__filter-btn" data-role="filter" title="Advanced filters coming soon"><i class="bi bi-filter-right"></i> Filter</button>` : ""}
            ${showFilterButton ? `<button type="button" class="sg-datatable__clear-btn" data-role="clear-filters" ${hasActiveFilters ? "" : "disabled"}>Clear All</button>` : ""}
          </div>
          ${tagHtml ? `<div class="sg-datatable__tags">${tagHtml}</div>` : ""}
        </div>
        <div class="sg-datatable__subheader-right">
          ${toolbarActionsHtml ? `<div class="sg-datatable__toolbar-actions">${toolbarActionsHtml}</div>` : ""}
          ${
            hideSearch
              ? ""
              : `
            <div class="sg-datatable__search">
              ${searchScope ? `<span class="sg-datatable__scope">${escapeHtml(searchScope)} <i class="bi bi-caret-down-fill"></i></span>` : ""}
              <input type="search" class="form-control form-control-sm sg-datatable__search-input" placeholder="Search" value="${escapeHtml(q ?? "")}" data-role="search" aria-label="Search table" />
              <button type="button" class="sg-datatable__search-submit" data-role="search-submit">Search</button>
            </div>
          `
          }
        </div>
      </div>`;

    const footer = hideFooter
      ? ""
      : `
      <div class="sg-datatable__footer">
        <div class="sg-datatable__results">
          <span>${rangeStart}</span>
          <span class="sg-datatable__results-dash" aria-hidden="true"><i class="bi bi-dash-lg"></i></span>
          <span>${rangeEnd} of ${total} results</span>
        </div>
        <div class="sg-datatable__pagination">
          <span class="sg-datatable__page-label">${currentPage} of ${lastPage} pages</span>
          <button type="button" class="sg-datatable__page-btn" data-role="prev" ${currentPage <= 1 ? "disabled" : ""}>Prev</button>
          <button type="button" class="sg-datatable__page-btn" data-role="next" ${currentPage >= lastPage ? "disabled" : ""}>Next</button>
        </div>
      </div>`;

    const embeddedClass = embedded ? " sg-datatable--embedded" : "";

    return `
      <div id="${escapeAttr(id)}" class="sg-datatable${embeddedClass}" data-component="DataTable">
        ${toolbar}
        <div class="sg-datatable__scroll table-responsive">
          <table class="table table-hover sg-datatable__table mb-0">
            <thead><tr>${checkHeader}${headers}</tr></thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
        ${footer}
      </div>
    `;
  }

  /**
   * @param {HTMLElement} root
   * @param {{
   *   onChange: (next: { sort?: string, q?: string, page?: number }) => void,
   *   onNavigate?: (path: string) => void,
   *   onRemoveFilter?: (tagId: string) => void,
   * } | undefined} [handlers]
   */
  // @ts-ignore -- intentional 2-arg override of AbstractViewModelComponent.bind
  bind(root, handlers) {
    if (!handlers) return;
    bindDataTable(root, this.props, handlers);
  }
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
