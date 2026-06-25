/*
 * Runtime configuration for structs-control.
 *
 * This file is loaded as a plain <script> before the bundle so operators can
 * redeploy the same static build against any Guild API host without rebuilding.
 * Edit values per environment; do NOT commit secrets here.
 *
 * Fields (all optional, with sane defaults applied by Store.config):
 *   guildApiUrl     Full base URL of the Guild API, e.g. "https://guild.example.com"
 *                   When empty, the SPA uses same-origin "/api" (dev proxy).
 *   chainWsUrl      Override Stargate WebSocket URL; otherwise sourced from
 *                   GET /guild/{id}.data.client_websocket.
 *   natsWsUrl       Override NATS/GRASS WebSocket URL; otherwise sourced from
 *                   GET /guild/{id}.data.grass_nats_websocket.
 *   defaultGuildId  Optional guild ID to preselect on the login screen (e.g. "0-1").
 *   devGallery      "1" to expose /dev/components and /dev/tests routes.
 */
window.STRUCTS_CONFIG = {
  guildApiUrl: "",
  chainWsUrl: "",
  natsWsUrl: "",
  defaultGuildId: "0-1",
  devGallery: "",
};
