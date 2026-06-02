import { idle, isStale } from "./Resource.js";
import { matches, serialize } from "./keys.js";

/**
 * @typedef {import("./Resource.js").Resource<unknown>} AnyResource
 * @typedef {ReadonlyArray<string | number>} CacheKey
 * @typedef {(resource: AnyResource) => void} Subscriber
 */

/**
 * Central reactive store for the SPA.
 *
 * Holds a `Map<serialized key, Resource>` plus a per-key subscriber list. Plays
 * the role that Redux / Zustand / TanStack Query plays in a React app, but
 * shaped for our domain (network reads + chain mutations + GRASS invalidation).
 *
 * View models never call `fetch`. They call `store.query(...)` (read) or
 * `store.tx.enqueue(...)` (write). GRASS listeners call `store.invalidate(...)`.
 */
export class Store {
  constructor() {
    /** @type {Map<string, AnyResource>} */
    this._resources = new Map();
    /** @type {Map<string, Set<Subscriber>>} */
    this._subscribers = new Map();
    /** @type {import("./QueryClient.js").QueryClient | null} */
    this.queryClient = null;
    /** @type {import("./TxQueue.js").TxQueue | null} */
    this.tx = null;
    /** @type {import("./session.js").Session | null} */
    this.session = null;
    /** @type {{ guildApiUrl: string, chainWsUrl: string, natsWsUrl: string, defaultGuildId: string, devGallery: string }} */
    this.config = {
      guildApiUrl: "",
      chainWsUrl: "",
      natsWsUrl: "",
      defaultGuildId: "",
      devGallery: "",
    };
  }

  /**
   * @param {CacheKey} key
   * @returns {AnyResource}
   */
  read(key) {
    return this._resources.get(serialize(key)) ?? idle();
  }

  /**
   * @param {CacheKey} key
   * @param {AnyResource} resource
   */
  write(key, resource) {
    const sk = serialize(key);
    this._resources.set(sk, resource);
    const subs = this._subscribers.get(sk);
    if (subs) {
      for (const sub of subs) sub(resource);
    }
  }

  /**
   * Subscribe to changes for a single key. Returns an unsubscribe function.
   * @param {CacheKey} key
   * @param {Subscriber} subscriber
   * @returns {() => void}
   */
  subscribe(key, subscriber) {
    const sk = serialize(key);
    let subs = this._subscribers.get(sk);
    if (!subs) {
      subs = new Set();
      this._subscribers.set(sk, subs);
    }
    subs.add(subscriber);
    return () => {
      const set = this._subscribers.get(sk);
      if (!set) return;
      set.delete(subscriber);
      if (set.size === 0) this._subscribers.delete(sk);
    };
  }

  /**
   * Mark resources matching the pattern as stale. If `refetch` is true and the
   * QueryClient knows how to refetch a key (because someone is subscribed),
   * it triggers a background fetch.
   *
   * @param {CacheKey} pattern   wildcards via "*" segments
   * @param {{ refetch?: boolean }} [options]
   * @returns {number} number of resources invalidated
   */
  invalidate(pattern, options = {}) {
    let count = 0;
    for (const [sk, resource] of this._resources) {
      const key = sk.split("::");
      if (!matches(key, pattern)) continue;
      const next = { ...resource, stale: true };
      this._resources.set(sk, next);
      count++;
      const subs = this._subscribers.get(sk);
      if (subs && options.refetch !== false && this.queryClient) {
        this.queryClient._maybeRefetch(key);
      }
      if (subs) {
        for (const sub of subs) sub(next);
      }
    }
    return count;
  }

  /**
   * Convenience for "I want this resource now, fetch if needed." Delegates to
   * QueryClient which handles staleness, dedup, and refetch.
   *
   * @template T
   * @param {CacheKey} key
   * @param {() => Promise<T>} fetcher
   * @param {{ staleTime?: number, ttl?: number }} [options]
   * @returns {Promise<import("./Resource.js").Resource<T>>}
   */
  query(key, fetcher, options) {
    if (!this.queryClient) {
      throw new Error("Store.queryClient not attached. Did you call new QueryClient(store)?");
    }
    return this.queryClient.query(key, fetcher, options);
  }

  /**
   * Drop everything. Used on logout.
   */
  clear() {
    this._resources.clear();
    for (const subs of this._subscribers.values()) {
      for (const sub of subs) sub(idle());
    }
  }

  /**
   * Return staleness of a single resource against a TTL. Convenience for
   * components deciding whether to show a "refreshing" indicator.
   * @param {CacheKey} key
   * @param {number} maxAgeMs
   * @returns {boolean}
   */
  isStale(key, maxAgeMs) {
    return isStale(this.read(key), maxAgeMs);
  }
}
