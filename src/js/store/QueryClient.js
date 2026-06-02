import { idle, loading, success, error as errorResource, missing as missingResource, isStale } from "./Resource.js";
import { serialize } from "./keys.js";
import { GuildAPIError } from "../errors/GuildAPIError.js";

/**
 * @typedef {import("./Store.js").Store} Store
 * @typedef {ReadonlyArray<string | number>} CacheKey
 * @typedef {() => Promise<unknown>} Fetcher
 */

const DEFAULT_STALE_TIME_MS = 30_000;
const DEFAULT_TTL_MS = 5 * 60_000;

/**
 * Cache layer over Store. Provides:
 *  - request deduplication (concurrent calls to the same key share one promise)
 *  - staleness (TTL) tracking
 *  - background refetch on invalidate when someone is subscribed
 *  - GuildAPIError.missing -> Resource{status:"missing"} graceful degradation
 *
 * Constructor side-effect: attaches itself to `store.queryClient`.
 */
export class QueryClient {
  /**
   * @param {Store} store
   */
  constructor(store) {
    this.store = store;
    store.queryClient = this;
    /** @type {Map<string, Promise<unknown>>} */
    this._inFlight = new Map();
    /** @type {Map<string, { fetcher: Fetcher, staleTime: number, ttl: number }>} */
    this._fetchers = new Map();
  }

  /**
   * Read-through fetch. Returns immediately with the current resource and
   * kicks off a fetch in the background if needed.
   *
   * @template T
   * @param {CacheKey} key
   * @param {Fetcher} fetcher
   * @param {{ staleTime?: number, ttl?: number, force?: boolean }} [options]
   * @returns {Promise<import("./Resource.js").Resource<T>>}
   */
  async query(key, fetcher, options = {}) {
    const sk = serialize(key);
    const staleTime = options.staleTime ?? DEFAULT_STALE_TIME_MS;
    const ttl = options.ttl ?? DEFAULT_TTL_MS;

    this._fetchers.set(sk, { fetcher, staleTime, ttl });

    const current = this.store.read(key);

    if (
      !options.force &&
      current.status === "success" &&
      !isStale(current, staleTime)
    ) {
      return /** @type {import("./Resource.js").Resource<T>} */ (current);
    }

    if (this._inFlight.has(sk)) {
      await this._inFlight.get(sk);
      return /** @type {import("./Resource.js").Resource<T>} */ (this.store.read(key));
    }

    this.store.write(key, loading(current.data));

    const promise = (async () => {
      try {
        const data = await fetcher();
        this.store.write(key, success(data));
      } catch (e) {
        if (e instanceof GuildAPIError && e.missing) {
          this.store.write(key, missingResource());
        } else {
          this.store.write(key, errorResource(e instanceof Error ? e : new Error(String(e)), current.data));
        }
      } finally {
        this._inFlight.delete(sk);
      }
    })();

    this._inFlight.set(sk, promise);
    await promise;

    return /** @type {import("./Resource.js").Resource<T>} */ (this.store.read(key));
  }

  /**
   * Called by Store.invalidate when a subscribed key is invalidated.
   * Re-runs the cached fetcher if we have one.
   * @param {CacheKey} key
   */
  _maybeRefetch(key) {
    const sk = serialize(key);
    const cached = this._fetchers.get(sk);
    if (!cached) return;
    if (this._inFlight.has(sk)) return;
    // fire-and-forget; query() will write back to the store
    void this.query(key, cached.fetcher, { staleTime: cached.staleTime, ttl: cached.ttl, force: true });
  }

  /**
   * Drop everything. Used on logout.
   */
  clear() {
    this._inFlight.clear();
    this._fetchers.clear();
  }
}

export { idle, loading, success, errorResource as error, missingResource as missing };
