/**
 * Structs entity-id type codes (`type-index` format).
 * @see https://structs.ai/schemas/formats
 */

export const ENTITY_TYPE = Object.freeze({
  GUILD: 0,
  PLAYER: 1,
  PLANET: 2,
  REACTOR: 3,
  SUBSTATION: 4,
  STRUCT: 5,
  ALLOCATION: 6,
  INFUSION: 7,
  ADDRESS: 8,
  FLEET: 9,
  PROVIDER: 10,
  AGREEMENT: 11,
});

/** @type {Readonly<Record<number, string>>} */
export const ENTITY_TYPE_NAMES = Object.freeze({
  [ENTITY_TYPE.GUILD]: "Guild",
  [ENTITY_TYPE.PLAYER]: "Player",
  [ENTITY_TYPE.PLANET]: "Planet",
  [ENTITY_TYPE.REACTOR]: "Reactor",
  [ENTITY_TYPE.SUBSTATION]: "Substation",
  [ENTITY_TYPE.STRUCT]: "Struct",
  [ENTITY_TYPE.ALLOCATION]: "Allocation",
  [ENTITY_TYPE.INFUSION]: "Infusion",
  [ENTITY_TYPE.ADDRESS]: "Address",
  [ENTITY_TYPE.FLEET]: "Fleet",
  [ENTITY_TYPE.PROVIDER]: "Provider",
  [ENTITY_TYPE.AGREEMENT]: "Agreement",
});
