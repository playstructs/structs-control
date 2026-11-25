import { GuildAPIError } from "../errors/GuildAPIError.js";
import { validate, envelopeSchema } from "../store/validator.js";

/**
 * Symfony returns `errors` as a string[] or a keyed object
 * (e.g. `{ signature_validation_failed: "Invalid signature" }`).
 *
 * @param {unknown} errors
 * @param {string} [fallback]
 * @returns {string[]}
 */
function normalizeApiErrors(errors, fallback = "Request failed") {
  if (Array.isArray(errors) && errors.length) return errors.map(String);
  if (errors && typeof errors === "object") {
    const values = Object.values(errors)
      .map(String)
      .filter(Boolean);
    if (values.length) return values;
  }
  return [fallback];
}

/**
 * @typedef {{
 *   reauthenticate?: boolean,
 *   envelope?: boolean,
 * }} RequestOptions
 */

/**
 * HTTP request wrapper for the Guild API.
 *
 * Differences from the structs-webapp version:
 *  - All fetches include `credentials: "include"` (cookie auth).
 *  - Envelope `{ success, errors[], data, meta? }` is validated; callers receive
 *    `data` by default (or `{ data, meta }` when `envelope: true`).
 *  - `lastMeta` always reflects the most recent successful response meta.
 *  - 401/403 triggers `onUnauthorized` once (single-flight via GuildAPI) then retries.
 *  - 404 responses on configured "optional" endpoints resolve to a
 *    `GuildAPIError { missing: true }`, which the QueryClient maps to a
 *    `Resource{status:"missing"}` for graceful degradation in the UI.
 *
 * No other module should call `fetch` directly. ESLint enforces this.
 */
export class JsonAjaxer {
  /**
   * @param {{ baseUrl?: string }} [options]
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl ?? "";
    /** @type {Set<string>} URL patterns that should resolve to "missing" on 404 */
    this._optionalPatterns = new Set();
    /**
     * Invoked on 401/403. Resolving true means the session was restored and the
     * request should be sent again. Wired by GuildAPI.setReauthenticator.
     * @type {null | (() => Promise<boolean>)}
     */
    this.onUnauthorized = null;
    /** Most recent successful envelope `meta` (protocol readiness, etc.). */
    this.lastMeta = /** @type {Record<string, unknown> | null} */ (null);
  }

  /**
   * Mark a URL path as optional. 404s on matching paths become `missing` rather
   * than throwing. Managers register their endpoints; the page renders an
   * empty state when the resource is `missing`.
   *
   * @param {string | RegExp} pathOrPattern
   */
  registerOptional(pathOrPattern) {
    this._optionalPatterns.add(typeof pathOrPattern === "string" ? pathOrPattern : pathOrPattern.source);
  }

  _isOptional(url) {
    for (const p of this._optionalPatterns) {
      if (url.includes(p)) return true;
      try {
        if (new RegExp(p).test(url)) return true;
      } catch {
        /* ignore bad regex */
      }
    }
    return false;
  }

  /**
   * @param {Response} response
   * @returns {boolean}
   */
  isAuthFailure(response) {
    return response.status === 401 || response.status === 403;
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {unknown} [body]
   * @param {RequestOptions} [options]
   * @returns {Promise<any>}
   */
  async request(method, path, body, options = {}) {
    const reauthenticate = options.reauthenticate !== false;
    const wantEnvelope = Boolean(options.envelope);
    const url = this.baseUrl + path;

    let response = await this._send(method, url, body);

    if (this.isAuthFailure(response) && this.onUnauthorized && reauthenticate) {
      const restored = await this.onUnauthorized();
      if (restored) {
        response = await this._send(method, url, body);
      }
    }

    if (response.status === 404 && this._isOptional(path)) {
      throw new GuildAPIError(`Optional endpoint missing: ${path}`, {
        status: 404,
        url,
        missing: true,
      });
    }

    if (this.isAuthFailure(response)) {
      throw new GuildAPIError(`Authentication required for ${path}`, {
        status: response.status,
        url,
      });
    }

    let json;
    const rawText = await response.text();
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch {
      const htmlHint = rawText.match(/<!--\s*([^<]{10,240}?)\s*(?:\(500 Internal Server Error\))?-->/i)?.[1]?.trim();
      const message = htmlHint || `Invalid JSON from ${path} (HTTP ${response.status})`;
      throw new GuildAPIError(message, { status: response.status, url });
    }

    if (!response.ok) {
      const errors = normalizeApiErrors(json?.errors, response.statusText || "HTTP error");
      throw new GuildAPIError(errors[0], { status: response.status, errors, url });
    }

    const validationErrors = validate(envelopeSchema, json);
    if (validationErrors.length) {
      throw new GuildAPIError(`Malformed envelope from ${path}: ${validationErrors[0]}`, {
        status: response.status,
        url,
      });
    }

    if (!json.success) {
      const errors = normalizeApiErrors(json.errors);
      throw new GuildAPIError(errors[0], { status: response.status, errors, url });
    }

    const meta =
      json.meta && typeof json.meta === "object" && !Array.isArray(json.meta)
        ? /** @type {Record<string, unknown>} */ (json.meta)
        : null;
    this.lastMeta = meta;

    if (wantEnvelope) {
      return { success: true, errors: json.errors ?? [], data: json.data, meta };
    }
    return json.data;
  }

  /**
   * @param {string} method
   * @param {string} url
   * @param {unknown} [body]
   * @returns {Promise<Response>}
   */
  async _send(method, url, body) {
    /** @type {RequestInit} */
    const init = {
      method,
      credentials: "include",
      redirect: "follow",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    try {
      return await fetch(url, init);
    } catch (e) {
      throw new GuildAPIError(`Network error: ${e instanceof Error ? e.message : String(e)}`, {
        url,
      });
    }
  }

  /**
   * @param {string} path
   * @param {RequestOptions} [options]
   */
  get(path, options) {
    return this.request("GET", path, undefined, options);
  }
  /**
   * @param {string} path
   * @param {unknown} body
   * @param {RequestOptions} [options]
   */
  post(path, body, options) {
    return this.request("POST", path, body, options);
  }
  /**
   * @param {string} path
   * @param {unknown} body
   * @param {RequestOptions} [options]
   */
  put(path, body, options) {
    return this.request("PUT", path, body, options);
  }
  /**
   * @param {string} path
   * @param {unknown} body
   * @param {RequestOptions} [options]
   */
  delete(path, body, options) {
    return this.request("DELETE", path, body, options);
  }
}
