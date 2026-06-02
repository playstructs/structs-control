/**
 * Canonical CustomEvent names. See docs/EVENTS.md for payload shapes and
 * emitter/listener catalog.
 */
export const EVENTS = Object.freeze({
  AUTH_LOGIN: "structs:auth:login",
  AUTH_LOGOUT: "structs:auth:logout",
  AUTH_FAILED: "structs:auth:failed",

  BLOCK_HEIGHT_CHANGED: "structs:block:height-changed",

  TX_ENQUEUED: "structs:tx:enqueued",
  TX_BROADCAST: "structs:tx:broadcast",
  TX_CONFIRMED: "structs:tx:confirmed",
  TX_FAILED: "structs:tx:failed",

  ROUTE_CHANGED: "structs:route:changed",
  SIDEBAR_TOGGLED: "structs:sidebar:toggled",
});
