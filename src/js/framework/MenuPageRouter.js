/**
 * URL-driven router. Each registered controller has named "pages" (methods);
 * the router maps a URL to (controllerName, pageName, params) and back.
 *
 * Differences from the structs-webapp version:
 *  - Source of truth is the URL via history.pushState / popstate.
 *  - Code-splitting is supported: registerLazyController(name, () => import(...))
 *    so each controller becomes its own webpack chunk.
 *  - Route table comes from constants/Routes.js (the single source of truth).
 *  - "Pages" don't go through localStorage; restore-on-reload comes from the URL.
 */

/** @typedef {{ activate(pageName: string, params: Record<string, string>): Promise<void> | void }} ControllerLike */

/**
 * @typedef {{
 *   path: string,
 *   controller: string,
 *   page: string,
 *   sidebar?: string,
 *   pill?: string,
 *   loginRequired?: boolean,
 * }} Route
 */

export class MenuPageRouter {
  /**
   * @param {Route[]} routes
   * @param {{ requireAuth: () => boolean, onMissingAuth: () => void }} authGate
   */
  constructor(routes, authGate) {
    this.routes = routes;
    this.authGate = authGate;
    /** @type {Map<string, ControllerLike | (() => Promise<ControllerLike>)>} */
    this._controllers = new Map();
    /** @type {Map<string, Promise<ControllerLike>>} */
    this._loading = new Map();
    /** @type {Set<(state: { controller: string, page: string, params: Record<string, string>, route: Route }) => void>} */
    this._listeners = new Set();
    /** @type {{ controller: string, page: string, params: Record<string, string>, route: Route } | null} */
    this.current = null;
    this.navigationId = 0;

    window.addEventListener("popstate", () => this._navigate(window.location.pathname + window.location.search, false));
  }

  /**
   * @param {string} name
   * @param {ControllerLike} controller
   */
  registerController(name, controller) {
    this._controllers.set(name, controller);
  }

  /**
   * @param {string} name
   * @param {() => Promise<ControllerLike>} loader
   */
  registerLazyController(name, loader) {
    this._controllers.set(name, loader);
  }

  /**
   * @param {(state: { controller: string, page: string, params: Record<string, string>, route: Route }) => void} listener
   */
  onChange(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Navigate to a path. Pushes history.
   * @param {string} path
   */
  goto(path) {
    this._navigate(path, true);
  }

  /**
   * Bootstrap from current URL after listeners are attached.
   */
  start() {
    this._navigate(window.location.pathname + window.location.search, false);
  }

  /**
   * @param {string} fullPath
   * @param {boolean} push
   */
  async _navigate(fullPath, push) {
    const [pathOnly, query] = fullPath.split("?");
    const match = this._matchRoute(pathOnly || "/");
    if (!match) {
      // unknown route -- redirect home
      if (push) history.replaceState(null, "", "/overview");
      return this._navigate("/overview", false);
    }
    const { route, params } = match;

    // merge query-string params (useful for DataTable URL state)
    if (query) {
      for (const [k, v] of new URLSearchParams(query)) {
        params[k] = v;
      }
    }

    if (route.loginRequired && !this.authGate.requireAuth()) {
      this.authGate.onMissingAuth();
      return;
    }

    if (push && fullPath !== window.location.pathname + window.location.search) {
      history.pushState(null, "", fullPath);
    }

    this.navigationId++;
    const navId = this.navigationId;

    const controller = await this._resolveController(route.controller);
    if (navId !== this.navigationId) return; // user navigated again while loading

    this.current = { controller: route.controller, page: route.page, params, route };
    for (const listener of this._listeners) listener(this.current);

    try {
      await controller.activate(route.page, params);
    } catch (e) {
      console.error(`[Router] ${route.controller}.${route.page} threw:`, e);
    }
  }

  /**
   * @param {string} path
   * @returns {{ route: Route, params: Record<string, string> } | null}
   */
  _matchRoute(path) {
    for (const route of this.routes) {
      const params = this._matchPath(route.path, path);
      if (params) return { route, params };
    }
    return null;
  }

  /**
   * @param {string} template e.g. "/players/:id"
   * @param {string} path     e.g. "/players/0-11"
   * @returns {Record<string, string> | null}
   */
  _matchPath(template, path) {
    const tParts = template.split("/").filter(Boolean);
    const pParts = path.split("/").filter(Boolean);
    if (tParts.length !== pParts.length) return null;
    const out = /** @type {Record<string, string>} */ ({});
    for (let i = 0; i < tParts.length; i++) {
      const t = tParts[i];
      const p = pParts[i];
      if (t.startsWith(":")) {
        out[t.slice(1)] = decodeURIComponent(p);
      } else if (t !== p) {
        return null;
      }
    }
    return out;
  }

  async _resolveController(name) {
    const entry = this._controllers.get(name);
    if (!entry) throw new Error(`No controller registered: ${name}`);
    if (typeof entry !== "function") return entry;

    const loading = this._loading.get(name);
    if (loading) return loading;
    const promise = entry().then((c) => {
      this._controllers.set(name, c);
      return c;
    });
    this._loading.set(name, promise);
    try {
      return await promise;
    } finally {
      this._loading.delete(name);
    }
  }

  /**
   * Build a URL from a route name + params (inverse of _matchPath).
   * @param {string} controllerName
   * @param {string} pageName
   * @param {Record<string, string>} [params]
   * @returns {string}
   */
  buildPath(controllerName, pageName, params = {}) {
    const route = this.routes.find((r) => r.controller === controllerName && r.page === pageName);
    if (!route) return "/";
    let path = route.path;
    const used = new Set();
    path = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, k) => {
      used.add(k);
      return encodeURIComponent(params[k] ?? "");
    });
    const remaining = Object.entries(params).filter(([k]) => !used.has(k));
    if (remaining.length) {
      const qs = new URLSearchParams(/** @type {[string, string][]} */ (remaining));
      path += `?${qs.toString()}`;
    }
    return path;
  }
}
