import { keys } from "../store/keys.js";
import { ENTITY_TYPE } from "../constants/EntityTypes.js";
import { parseEntityId } from "./entityId.js";

/**
 * @typedef {import("../types/api.js").PlayerData} PlayerData
 * @typedef {import("../types/api.js").SubstationData} SubstationData
 * @typedef {import("../types/api.js").ReactorData} ReactorData
 * @typedef {import("../types/api.js").GuildData} GuildData
 */

/**
 * @typedef {{
 *   players: Map<string, PlayerData>,
 *   substations: Map<string, SubstationData>,
 *   reactors: Map<string, ReactorData>,
 *   guilds: Map<string, GuildData>,
 * }} EntityLookup
 */

/**
 * @typedef {{
 *   players?: PlayerData[],
 *   substations?: SubstationData[],
 *   reactors?: ReactorData[],
 *   guilds?: GuildData[],
 * }} EntityLookupExtras
 */

/**
 * @param {unknown} rows
 * @param {Map<string, object>} map
 * @param {string} [idKey]
 */
function indexRows(rows, map, idKey = "id") {
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const id = /** @type {Record<string, unknown>} */ (row)[idKey];
    if (id != null && id !== "") map.set(String(id), /** @type {object} */ (row));
  }
}

/**
 * Build label enrichment maps from Store catalog caches and optional page-local rows.
 * @param {import("../store/Store.js").Store} store
 * @param {EntityLookupExtras} [extras]
 * @returns {EntityLookup}
 */
export function buildEntityLookup(store, extras = {}) {
  /** @type {EntityLookup} */
  const lookup = {
    players: new Map(),
    substations: new Map(),
    reactors: new Map(),
    guilds: new Map(),
  };

  const session = store.session?.data;
  const guildId = session?.guildId ? String(session.guildId) : "";

  if (guildId) {
    indexRows(store.read(keys.guildRoster(guildId)).data, lookup.players);
    const guild = store.read(keys.guild(guildId)).data;
    if (guild && typeof guild === "object") lookup.guilds.set(guildId, /** @type {GuildData} */ (guild));
  }

  const guildThis = store.read(keys.guildThis()).data;
  if (guildThis && typeof guildThis === "object") {
    const id = /** @type {GuildData} */ (guildThis).id;
    if (id) lookup.guilds.set(String(id), /** @type {GuildData} */ (guildThis));
  }

  indexRows(store.read(keys.substationList()).data, lookup.substations);
  indexRows(store.read(keys.reactorNetwork()).data, lookup.reactors);
  if (guildId) indexRows(store.read(keys.reactorList(guildId)).data, lookup.reactors);

  indexRows(extras.players, lookup.players);
  indexRows(extras.substations, lookup.substations);
  indexRows(extras.reactors, lookup.reactors);
  indexRows(extras.guilds, lookup.guilds);

  return lookup;
}

/**
 * Human label for an entity id using cached rows when available.
 * @param {unknown} value
 * @param {EntityLookup | null | undefined} lookup
 * @returns {string}
 */
export function entityLabel(value, lookup) {
  if (value == null || value === "" || value === "—") return "—";
  const id = String(value).trim();
  const parsed = parseEntityId(id);
  if (!parsed) return id;

  const name = humanNameFor(parsed.typeCode, id, lookup);
  return name ? `${name} (${id})` : id;
}

/**
 * @param {number} typeCode
 * @param {string} id
 * @param {EntityLookup | null | undefined} lookup
 */
function humanNameFor(typeCode, id, lookup) {
  if (!lookup) return "";
  switch (typeCode) {
    case ENTITY_TYPE.PLAYER:
      return lookup.players.get(id)?.name?.trim() ?? "";
    case ENTITY_TYPE.SUBSTATION:
      return lookup.substations.get(id)?.name?.trim() ?? "";
    case ENTITY_TYPE.GUILD:
      return lookup.guilds.get(id)?.name?.trim() ?? "";
    default:
      return "";
  }
}
