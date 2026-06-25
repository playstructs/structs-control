/**
 * Profile-picture (PFP) rendering constants.
 *
 * Ported from references/structs-webapp/src/js/constants/PfpConstants.js. A PFP
 * is composed of 5 stacked PNG layers; the counts below define the valid
 * 1-based index range per layer (and must match the PNG files under
 * `public/img/pfp/`). Asset paths are centralized here so a future base-path
 * change is a one-line edit.
 */
export const PFP_PART_COUNTS = Object.freeze({
  head: 87,
  neck: 10,
  body: 57,
  arms: 34,
  background: 6,
});

/** Layer paint order, back to front (head paints on top). */
export const PFP_LAYER_ORDER = Object.freeze(["background", "arms", "body", "neck", "head"]);

/** Base URL for layer PNGs: `${PFP_ASSET_BASE}/${part}/pfp_${part}_${index}.png`. */
export const PFP_ASSET_BASE = "/img/pfp";

/** Shown when a PFP has no render attributes. */
export const PFP_PLACEHOLDER = "/img/portrait-placeholder.png";
