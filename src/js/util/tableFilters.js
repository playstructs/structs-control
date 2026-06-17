/**
 * Client-side advanced filter utilities for DataTable.
 * URL shape: ?f=status:online,jailed&capacity.min=15000&capacity.max=5000000&field=name&q=alice
 * Range values are stored in base chain units (milliwatts for energy).
 */

import { formatFilterBoundTag } from "./filterUnits.js";

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   type: "checkbox",
 *   options: Array<{ value: string, label: string }>,
 *   getValue: (row: any) => string | number | null | undefined,
 * }} CheckboxFilterField
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   type: "range",
 *   getValue: (row: any) => number | null | undefined,
 *   denom?: string,
 * }} RangeFilterField
 */

/** @typedef {CheckboxFilterField | RangeFilterField} FilterField */

/**
 * @typedef {Record<string, string[] | { min?: number, max?: number }>} FilterState
 */

/**
 * @param {any[]} rows
 * @param {FilterState | undefined} filters
 * @param {FilterField[] | undefined} schema
 * @returns {any[]}
 */
export function applyFilters(rows, filters, schema) {
  if (!filters || !schema?.length) return rows;
  return rows.filter((row) =>
    schema.every((field) => {
      const state = filters[field.id];
      if (!state) return true;

      if (field.type === "checkbox") {
        const selected = /** @type {string[]} */ (state);
        if (!selected.length) return true;
        const raw = normalizeValue(field.getValue(row));
        return selected.some((v) => normalizeValue(v) === raw);
      }

      const range = /** @type {{ min?: number, max?: number }} */ (state);
      const hasMin = range.min != null && range.min !== "";
      const hasMax = range.max != null && range.max !== "";
      if (!hasMin && !hasMax) return true;

      const num = field.getValue(row);
      if (num == null || Number.isNaN(num)) return false;
      if (hasMin && num < Number(range.min)) return false;
      if (hasMax && num > Number(range.max)) return false;
      return true;
    }),
  );
}

/**
 * @param {FilterState | undefined} filters
 * @param {FilterField[] | undefined} schema
 * @returns {Array<{ id: string, label: string }>}
 */
export function filtersToTags(filters, schema) {
  if (!filters || !schema?.length) return [];
  /** @type {Array<{ id: string, label: string }>} */
  const tags = [];

  for (const field of schema) {
    const state = filters[field.id];
    if (!state) continue;

    if (field.type === "checkbox") {
      const selected = /** @type {string[]} */ (state);
      for (const value of selected) {
        const opt = field.options.find((o) => o.value === value);
        tags.push({
          id: `${field.id}:${value}`,
          label: `${field.label}: ${opt?.label ?? value}`,
        });
      }
      continue;
    }

    const range = /** @type {{ min?: number, max?: number }} */ (state);
    if (range.min != null && range.min !== "") {
      const minLabel = field.denom
        ? formatFilterBoundTag(Number(range.min), field.denom)
        : String(range.min);
      tags.push({ id: `${field.id}.min`, label: `${field.label} Min: ${minLabel}` });
    }
    if (range.max != null && range.max !== "") {
      const maxLabel = field.denom
        ? formatFilterBoundTag(Number(range.max), field.denom)
        : String(range.max);
      tags.push({ id: `${field.id}.max`, label: `${field.label} Max: ${maxLabel}` });
    }
  }

  return tags;
}

/**
 * Parse `f` param and `*.min` / `*.max` keys from a flat params object.
 *
 * @param {Record<string, string | undefined>} params
 * @param {string} [prefix] — e.g. "y." for your-reactors table on a dual-table page
 * @param {FilterField[] | undefined} schema
 * @returns {FilterState}
 */
export function parseFiltersFromParams(params, prefix = "", schema) {
  /** @type {FilterState} */
  const filters = {};
  const fKey = `${prefix}f`;
  const fRaw = params[fKey];
  if (fRaw) {
    for (const group of fRaw.split(";").filter(Boolean)) {
      const colon = group.indexOf(":");
      if (colon < 0) continue;
      const id = group.slice(0, colon);
      const values = group.slice(colon + 1).split(",").filter(Boolean);
      if (values.length) filters[id] = values;
    }
  }

  if (schema) {
    for (const field of schema) {
      if (field.type !== "range") continue;
      const minKey = `${prefix}${field.id}.min`;
      const maxKey = `${prefix}${field.id}.max`;
      const min = params[minKey];
      const max = params[maxKey];
      if (min != null || max != null) {
        filters[field.id] = {
          ...(min != null && min !== "" ? { min: Number(min) } : {}),
          ...(max != null && max !== "" ? { max: Number(max) } : {}),
        };
      }
    }
  }

  return filters;
}

/**
 * Serialize filter state into flat URL param keys.
 *
 * @param {FilterState | undefined} filters
 * @param {FilterField[] | undefined} schema
 * @param {string} [prefix]
 * @returns {Record<string, string>}
 */
export function serializeFiltersToParams(filters, schema, prefix = "") {
  /** @type {Record<string, string>} */
  const out = {};
  if (!filters || !schema?.length) return out;

  const checkboxParts = [];
  for (const field of schema) {
    if (field.type !== "checkbox") continue;
    const selected = /** @type {string[] | undefined} */ (filters[field.id]);
    if (selected?.length) checkboxParts.push(`${field.id}:${selected.join(",")}`);
  }
  if (checkboxParts.length) out[`${prefix}f`] = checkboxParts.join(";");

  for (const field of schema) {
    if (field.type !== "range") continue;
    const range = /** @type {{ min?: number, max?: number } | undefined} */ (filters[field.id]);
    if (!range) continue;
    if (range.min != null && range.min !== "") out[`${prefix}${field.id}.min`] = String(range.min);
    if (range.max != null && range.max !== "") out[`${prefix}${field.id}.max`] = String(range.max);
  }

  return out;
}

/**
 * @param {FilterState} filters
 * @param {string} tagId
 * @returns {FilterState}
 */
export function removeFilterTag(filters, tagId) {
  const next = { ...filters };

  if (tagId.includes(":")) {
    const [fieldId, value] = tagId.split(":");
    const cur = /** @type {string[] | undefined} */ (next[fieldId]);
    if (!cur) return next;
    const remaining = cur.filter((v) => v !== value);
    if (remaining.length) next[fieldId] = remaining;
    else delete next[fieldId];
    return next;
  }

  if (tagId.endsWith(".min") || tagId.endsWith(".max")) {
    const fieldId = tagId.replace(/\.(min|max)$/, "");
    const suffix = tagId.endsWith(".min") ? "min" : "max";
    const cur = /** @type {{ min?: number, max?: number } | undefined} */ (next[fieldId]);
    if (!cur) return next;
    const copy = { ...cur };
    delete copy[suffix];
    if (copy.min == null && copy.max == null) delete next[fieldId];
    else next[fieldId] = copy;
  }

  return next;
}

/**
 * @param {FilterState | undefined} filters
 * @returns {boolean}
 */
export function hasActiveFilters(filters) {
  if (!filters) return false;
  return Object.entries(filters).some(([, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    if (v && typeof v === "object") {
      return v.min != null && v.min !== "" || v.max != null && v.max !== "";
    }
    return false;
  });
}

/**
 * Strip all filter-related keys from params for Clear All.
 *
 * @param {Record<string, unknown>} params
 * @param {FilterField[] | undefined} schema
 * @param {string} [prefix]
 * @returns {Record<string, unknown>}
 */
export function clearFilterParams(params, schema, prefix = "") {
  const next = { ...params };
  delete next[`${prefix}f`];
  if (schema) {
    for (const field of schema) {
      if (field.type === "range") {
        delete next[`${prefix}${field.id}.min`];
        delete next[`${prefix}${field.id}.max`];
      }
    }
  }
  return next;
}

/**
 * @param {string | number | null | undefined} v
 * @returns {string}
 */
function normalizeValue(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

/**
 * @param {Record<string, unknown>} params
 * @param {string} prefix
 * @returns {{ q?: string, sort?: string, page?: number, field?: string }}
 */
export function parseTableParams(params, prefix = "") {
  return {
    q: params[`${prefix}q`] != null ? String(params[`${prefix}q`]) : undefined,
    sort: params[`${prefix}sort`] != null ? String(params[`${prefix}sort`]) : undefined,
    page: params[`${prefix}page`] != null ? Number(params[`${prefix}page`]) || 1 : undefined,
    field: params[`${prefix}field`] != null ? String(params[`${prefix}field`]) : undefined,
  };
}

/**
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} next
 * @param {string} prefix
 * @param {FilterField[] | undefined} schema
 * @returns {Record<string, string>}
 */
export function mergeTableState(base, next, prefix = "", schema) {
  const merged = { ...base, ...next };

  const qKey = `${prefix}q`;
  const sortKey = `${prefix}sort`;
  const pageKey = `${prefix}page`;
  const fieldKey = `${prefix}field`;

  if (!merged[qKey]) delete merged[qKey];
  if (!merged[sortKey]) delete merged[sortKey];
  if (merged[pageKey] === 1 || merged[pageKey] === "1") delete merged[pageKey];
  if (!merged[fieldKey]) delete merged[fieldKey];

  if ("f" in next && next.f === "") delete merged[`${prefix}f`];
  if (schema) {
    for (const field of schema) {
      if (field.type === "range") {
        if (`${field.id}.min` in next && !next[`${field.id}.min`]) delete merged[`${prefix}${field.id}.min`];
        if (`${field.id}.max` in next && !next[`${field.id}.max`]) delete merged[`${prefix}${field.id}.max`];
      }
    }
  }

  if (next.filters === null || next.filters === undefined && "filters" in next) {
    const cleared = clearFilterParams(merged, schema, prefix);
    return Object.fromEntries(Object.entries(cleared).map(([k, v]) => [k, String(v)]));
  }

  return Object.fromEntries(
    Object.entries(merged)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
}
