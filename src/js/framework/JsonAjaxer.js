import { GuildAPIError } from "../errors/GuildAPIError.js";
import { validate, envelopeSchema } from "../store/validator.js";

/**
 * HTTP request wrapper for the Guild API.
 *
 * Differences from the structs-webapp version:
 *  - All fetches include `credentials: "include"` (cookie auth).
 *  - Envelope `{ success, errors[], data }` is validated and unwrapped here, so
 *    callers always receive `data` or get a `GuildAPIError` thrown.
 *  - 404 responses on configured "optional" endpoints resolve to a
 *    `GuildAPIError { missing: true }`, which the QueryClient maps to a
 *    `Resource{status:"missing"}` for graceful degradation in the UI.
 *  - All other non-2xx responses throw `GuildAPIError` with HTTP status + body.
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
   * @param {string} method
   * @param {string} path
   * @param {unknown} [body]
   * @returns {Promise<any>}
   */
  async request(method, path, body) {
    const url = this.baseUrl + path;
    /** @type {RequestInit} */
    const init = {
      method,
      credentials: "include",
      redirect: "follow",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    let response;
    try {
      response = await fetch(url, init);
    } catch (e) {
      throw new GuildAPIError(`Network error: ${e instanceof Error ? e.message : String(e)}`, {
        url,
      });
    }

    if (response.status === 404 && this._isOptional(path)) {
      throw new GuildAPIError(`Optional endpoint missing: ${path}`, {
        status: 404,
        url,
        missing: true,
      });
    }

    let json;
    try {
      json = await response.json();
    } catch {
      throw new GuildAPIError(`Invalid JSON from ${path}`, { status: response.status, url });
    }

    if (!response.ok) {
      const errors = Array.isArray(json?.errors) ? json.errors : [response.statusText || "HTTP error"];
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
      const errors = Array.isArray(json.errors) && json.errors.length ? json.errors : ["Request failed"];
      throw new GuildAPIError(errors[0], { status: response.status, errors, url });
    }

    return json.data;
  }

  get(path) {
    return this.request("GET", path);
  }
  post(path, body) {
    return this.request("POST", path, body);
  }
  put(path, body) {
    return this.request("PUT", path, body);
  }
  delete(path, body) {
    return this.request("DELETE", path, body);
  }
}
