import { keys } from "./keys.js";

/**
 * Declarative map from GRASS subjects -> cache keys to invalidate when an event
 * with that subject arrives. Used by AbstractGrassListener subclasses via the
 * convenience `bridge.handle(subject, messageData)` method.
 *
 * Subjects come from structs.ai/api/streaming/event-types -- we keep this small
 * and expand as listeners are added.
 *
 * Pattern: subject -> Array<(messageData) => CacheKey | null>
 */

/**
 * @typedef {import("./Store.js").Store} Store
 * @typedef {ReadonlyArray<string | number>} CacheKey
 * @typedef {(data: any) => CacheKey | CacheKey[] | null} KeyResolver
 */

export class InvalidationBridge {
  /**
   * @param {Store} store
   */
  constructor(store) {
    this.store = store;
    /** @type {Map<string, KeyResolver[]>} */
    this._mappings = new Map();
    this._defaultMappings();
  }

  /**
   * @param {string} subjectPattern subject prefix (e.g. "structs.player.*")
   * @param {KeyResolver} resolver function (messageData) -> cache key(s) to invalidate
   */
  on(subjectPattern, resolver) {
    let list = this._mappings.get(subjectPattern);
    if (!list) {
      list = [];
      this._mappings.set(subjectPattern, list);
    }
    list.push(resolver);
  }

  /**
   * Look up matching resolvers and invalidate the keys they return.
   * @param {string} subject
   * @param {any} messageData
   * @returns {number} count of keys invalidated
   */
  handle(subject, messageData) {
    let total = 0;
    for (const [pattern, resolvers] of this._mappings) {
      if (!matchesSubject(subject, pattern)) continue;
      for (const resolve of resolvers) {
        const result = resolve(messageData);
        if (!result) continue;
        const list = Array.isArray(result[0]) ? /** @type {CacheKey[]} */ (result) : [/** @type {CacheKey} */ (result)];
        for (const key of list) total += this.store.invalidate(key);
      }
    }
    return total;
  }

  _defaultMappings() {
    this.on("structs.player.*", (data) => (data?.player_id ? keys.player(data.player_id) : null));
    this.on("structs.player.*", (data) =>
      data?.guild_id ? keys.guildRoster(data.guild_id) : null,
    );
    this.on("structs.guild.*", (data) => (data?.guild_id ? keys.guild(data.guild_id) : null));
    this.on("structs.substation.*", (data) =>
      data?.substation_id ? keys.substation(data.substation_id) : null,
    );
    this.on("structs.allocation.*", (data) => {
      /** @type {import("./keys.js").CacheKey[]} */
      const out = [keys.allocationList()];
      if (data?.allocation_id) out.push(keys.allocation(data.allocation_id));
      if (data?.source_id) out.push(keys.allocationBySource(data.source_id));
      if (data?.destination_id) out.push(keys.allocationByDestination(data.destination_id));
      return out;
    });
    this.on("structs.reactor.*", (data) => {
      /** @type {import("./keys.js").CacheKey[]} */
      const out = [];
      if (data?.reactor_id) {
        out.push(keys.reactor(data.reactor_id), keys.reactorInfusion(data.reactor_id));
      }
      return out.length ? out : null;
    });
    this.on("structs.guild.*", (data) =>
      data?.guild_id ? keys.membershipApplications(data.guild_id) : null,
    );
    this.on("structs.guild.*", (data) =>
      data?.guild_id ? keys.agreementList(data.guild_id) : null,
    );
  }
}

/**
 * @param {string} subject
 * @param {string} pattern
 */
function matchesSubject(subject, pattern) {
  if (pattern === subject) return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return subject.startsWith(prefix + ".") || subject === prefix;
  }
  if (pattern === "*" || pattern === ">") return true;
  return false;
}
