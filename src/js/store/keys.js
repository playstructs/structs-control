/**
 * Canonical cache keys for every Resource the Store holds. Centralizing them
 * here is what lets the GRASS-to-Store invalidation bridge work declaratively.
 *
 * Conventions:
 *  - keys are arrays of strings/numbers
 *  - first element is the "domain" (player, guild, substation, allocation, ...)
 *  - wildcard pattern: `["player", "*"]` matches every player resource
 *
 * Stringification is handled by Store.serialize() so keys can be used both as
 * Map keys and as event names.
 */

/** @typedef {ReadonlyArray<string | number>} CacheKey */

export const keys = {
  guild: (guildId) => Object.freeze(["guild", String(guildId)]),
  guildThis: () => Object.freeze(["guild", "this"]),
  guildSettings: () => Object.freeze(["guild", "settings"]),
  guildRoster: (guildId) => Object.freeze(["guild", String(guildId), "roster"]),
  guildPowerStats: (guildId) => Object.freeze(["guild", String(guildId), "power-stats"]),
  guildMembersCount: (guildId) => Object.freeze(["guild", String(guildId), "members-count"]),
  guildsDirectory: () => Object.freeze(["guild", "directory"]),

  player: (playerId) => Object.freeze(["player", String(playerId)]),
  playerInfusion: (playerId) => Object.freeze(["player", String(playerId), "infusion"]),
  playerAddresses: (playerId) => Object.freeze(["player", String(playerId), "addresses"]),
  playerIdByAddressGuild: (address, guildId) =>
    Object.freeze(["player", "by-address", String(address), String(guildId)]),

  substation: (substationId) => Object.freeze(["substation", String(substationId)]),
  substationList: () => Object.freeze(["substation", "list"]),
  substationPlayers: (substationId) => Object.freeze(["substation", String(substationId), "players"]),

  reactor: (reactorId) => Object.freeze(["reactor", String(reactorId)]),
  reactorList: (guildId) => Object.freeze(["reactor", "list", String(guildId ?? "")]),
  reactorNetwork: () => Object.freeze(["reactor", "network"]),

  membershipApplications: (guildId) => Object.freeze(["guild", String(guildId), "membership-applications"]),
  providerList: () => Object.freeze(["provider", "list"]),
  agreementList: (guildId) => Object.freeze(["agreement", "list", String(guildId)]),

  statRange: (metric, objectKey) => Object.freeze(["stat", String(metric), String(objectKey)]),
  reactorInfusion: (reactorId) => Object.freeze(["reactor", String(reactorId), "infusion"]),

  allocation: (allocationId) => Object.freeze(["allocation", String(allocationId)]),
  allocationList: () => Object.freeze(["allocation", "list"]),
  allocationBySource: (sourceId) => Object.freeze(["allocation", "by-source", String(sourceId)]),

  timestamp: () => Object.freeze(["meta", "timestamp"]),
  session: () => Object.freeze(["meta", "session"]),
};

/**
 * Tests whether `key` matches `pattern`, treating `"*"` as a wildcard segment.
 * @param {CacheKey} key
 * @param {CacheKey} pattern
 * @returns {boolean}
 */
export function matches(key, pattern) {
  if (pattern.length > key.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === "*") continue;
    if (pattern[i] !== key[i]) return false;
  }
  return true;
}

/**
 * @param {CacheKey} key
 * @returns {string}
 */
export function serialize(key) {
  return key.join("::");
}
