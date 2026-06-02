/**
 * @typedef {"idle" | "loading" | "success" | "error" | "missing"} ResourceStatus
 */

/**
 * @template T
 * @typedef {{
 *   status: ResourceStatus,
 *   data: T | null,
 *   error: Error | null,
 *   updatedAt: number,
 *   stale: boolean,
 * }} Resource
 */

/** @type {Resource<unknown>} */
export const IDLE_RESOURCE = Object.freeze({
  status: "idle",
  data: null,
  error: null,
  updatedAt: 0,
  stale: true,
});

/**
 * @template T
 * @param {T | null} [data]
 * @returns {Resource<T>}
 */
export function idle(data = null) {
  return { status: "idle", data, error: null, updatedAt: 0, stale: true };
}

/**
 * @template T
 * @param {T | null} [data]
 * @returns {Resource<T>}
 */
export function loading(data = null) {
  return { status: "loading", data, error: null, updatedAt: Date.now(), stale: false };
}

/**
 * @template T
 * @param {T} data
 * @returns {Resource<T>}
 */
export function success(data) {
  return { status: "success", data, error: null, updatedAt: Date.now(), stale: false };
}

/**
 * @template T
 * @param {Error} error
 * @param {T | null} [previousData]
 * @returns {Resource<T>}
 */
export function error(error, previousData = null) {
  return { status: "error", data: previousData, error, updatedAt: Date.now(), stale: true };
}

/**
 * @template T
 * @returns {Resource<T>}
 */
export function missing() {
  return { status: "missing", data: null, error: null, updatedAt: Date.now(), stale: false };
}

/**
 * @template T
 * @param {Resource<T>} resource
 * @param {number} maxAgeMs
 * @returns {boolean}
 */
export function isStale(resource, maxAgeMs) {
  if (resource.stale) return true;
  if (!resource.updatedAt) return true;
  return Date.now() - resource.updatedAt > maxAgeMs;
}
