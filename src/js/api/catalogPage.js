/** Symfony catalog page size (`PaginationLimits::DEFAULT`). */
export const CATALOG_PAGE_SIZE = 100;

/**
 * Helpers for catalog-read endpoints (`/api/{entity}/.../page/{page}`).
 *
 * Per Symfony `TableReadManager::queryAll`, catalog `data` is a **flat array**
 * of rows inside `{ success, errors, data }` — not `{ rows, page, page_size }`.
 * JsonAjaxer unwraps to `data`; this module normalizes that shape.
 */

/**
 * @typedef {{
 *   rows: unknown[],
 *   page: number,
 *   pageSize: number,
 *   hasMore: boolean,
 * }} CatalogPage
 */

/**
 * Normalize catalog page payload from JsonAjaxer (already unwrapped `data`).
 * @param {unknown} data
 * @returns {CatalogPage}
 */
export function normalizeCatalogPage(data) {
  if (Array.isArray(data)) {
    return { rows: data, page: 1, pageSize: CATALOG_PAGE_SIZE, hasMore: data.length >= CATALOG_PAGE_SIZE };
  }
  if (data && typeof data === "object") {
    const d = /** @type {{ rows?: unknown[], page?: number, page_size?: number }} */ (data);
    const rows = Array.isArray(d.rows) ? d.rows : [];
    const page = Number(d.page ?? 1);
    const pageSize = Number(d.page_size ?? CATALOG_PAGE_SIZE);
    const hasMore = rows.length >= pageSize;
    return { rows, page, pageSize, hasMore };
  }
  return { rows: [], page: 1, pageSize: 0, hasMore: false };
}

/**
 * Fetch one catalog page.
 * @param {{ get: (path: string) => Promise<unknown> }} ajax JsonAjaxer instance
 * @param {string} path e.g. `/substation/all/page/1`
 * @returns {Promise<CatalogPage>}
 */
export async function fetchCatalogPage(ajax, path) {
  const data = await ajax.get(path);
  return normalizeCatalogPage(data);
}

/**
 * Fetch all catalog pages until a short page is returned.
 * @param {{ get: (path: string) => Promise<unknown> }} ajax
 * @param {string} pathPrefix
 * @param {{ maxPages?: number }} [options]
 * @returns {Promise<unknown[]>}
 */
export async function fetchAllCatalogPages(ajax, pathPrefix, options = {}) {
  const maxPages = options.maxPages ?? 50;
  const prefix = pathPrefix.endsWith("/") ? pathPrefix : `${pathPrefix}/`;
  /** @type {unknown[]} */
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const { rows, hasMore } = await fetchCatalogPage(ajax, `${prefix}${page}`);
    all.push(...rows);
    if (!hasMore || rows.length === 0) break;
  }
  return all;
}

/**
 * Fetch a catalog list. Legacy bespoke list paths are not implemented in Symfony PHP.
 * @param {{ get: (path: string) => Promise<unknown> }} ajax
 * @param {string} catalogPathPrefix
 * @returns {Promise<unknown[]>}
 */
export async function fetchCatalogList(ajax, catalogPathPrefix) {
  return fetchAllCatalogPages(ajax, catalogPathPrefix);
}
