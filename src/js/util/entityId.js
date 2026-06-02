import { ENTITY_TYPE, ENTITY_TYPE_NAMES } from "../constants/EntityTypes.js";

/** @type {RegExp} */
export const ENTITY_ID_PATTERN = /^[0-9]+-[0-9]+$/;

/**
 * @typedef {{ typeCode: number, index: string, typeName: string }} ParsedEntityId
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEntityId(value) {
  return typeof value === "string" && ENTITY_ID_PATTERN.test(value.trim());
}

/**
 * @param {unknown} value
 * @returns {ParsedEntityId | null}
 */
export function parseEntityId(value) {
  if (!isEntityId(value)) return null;
  const id = String(value).trim();
  const dash = id.indexOf("-");
  const typeCode = Number(id.slice(0, dash));
  const index = id.slice(dash + 1);
  if (!Number.isInteger(typeCode) || typeCode < 0) return null;
  return {
    typeCode,
    index,
    typeName: ENTITY_TYPE_NAMES[typeCode] ?? "Object",
  };
}

/**
 * SPA route for an entity id, or null when no detail page exists.
 * @param {unknown} value
 * @returns {string | null}
 */
export function entityRoute(value) {
  const parsed = parseEntityId(value);
  if (!parsed) return null;
  const id = `${parsed.typeCode}-${parsed.index}`;
  switch (parsed.typeCode) {
    case ENTITY_TYPE.GUILD:
      return "/guild/details";
    case ENTITY_TYPE.PLAYER:
      return `/players/${encodeURIComponent(id)}`;
    case ENTITY_TYPE.REACTOR:
      return `/energy/reactors/${encodeURIComponent(id)}`;
    case ENTITY_TYPE.SUBSTATION:
      return `/energy/substations/${encodeURIComponent(id)}`;
    default:
      return null;
  }
}
