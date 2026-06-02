/**
 * Wire sort, search, pagination, row navigation, and optional filter-tag removal
 * for a rendered DataTable root element.
 *
 * @param {HTMLElement | Element | null | undefined} root
 * @param {{
 *   sort?: string,
 *   q?: string,
 *   page?: number,
 *   pageSize?: number,
 * }} params
 * @param {{
 *   onChange: (next: { sort?: string, q?: string, page?: number }) => void,
 *   onNavigate?: (path: string) => void,
 *   onRemoveFilter?: (tagId: string) => void,
 * }} handlers
 */
export function bindDataTable(root, params, handlers) {
  if (!root) return;
  const { onChange, onNavigate, onRemoveFilter } = handlers;
  const page = Number(params.page) || 1;
  const [sortField, sortDir] = (params.sort ?? "").split(":");

  root.querySelectorAll("th[data-col]").forEach((th) => {
    th.addEventListener("click", () => {
      const id = th.getAttribute("data-col");
      if (!id || th.classList.contains("is-no-sort")) return;
      const nextDir = sortField === id && sortDir === "asc" ? "desc" : "asc";
      onChange({ sort: `${id}:${nextDir}`, page: 1 });
    });
  });

  const search = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-role="search"]'));
  const submitSearch = () => {
    if (search) onChange({ q: search.value, page: 1 });
  };

  if (search) {
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitSearch();
      }
    });
    let t = 0;
    search.addEventListener("input", () => {
      clearTimeout(t);
      t = window.setTimeout(submitSearch, 300);
    });
  }

  root.querySelector('[data-role="search-submit"]')?.addEventListener("click", submitSearch);

  root.querySelector('[data-role="prev"]')?.addEventListener("click", () => {
    onChange({ page: Math.max(1, page - 1) });
  });
  root.querySelector('[data-role="next"]')?.addEventListener("click", () => {
    onChange({ page: page + 1 });
  });

  root.querySelector('[data-role="clear-filters"]')?.addEventListener("click", () => {
    if (search) search.value = "";
    onChange({ q: "", page: 1 });
  });

  root.querySelectorAll('[data-role="remove-filter"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const tagId = /** @type {HTMLElement} */ (btn).dataset.tagId;
      if (tagId && onRemoveFilter) onRemoveFilter(tagId);
    });
  });

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
 */
export function gotoTableState(router, basePath, params, next) {
  const merged = { ...params, ...next };
  if (!merged.q) delete merged.q;
  if (!merged.sort) delete merged.sort;
  if (merged.page === 1) delete merged.page;
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, String(v)])),
  ).toString();
  router.goto(basePath + (qs ? `?${qs}` : ""));
}
