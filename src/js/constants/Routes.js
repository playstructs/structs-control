/**
 * Route table. Single source of truth for URL <-> (controller, page).
 *
 * Adding a page:
 *   1. Add a row here.
 *   2. Add a pill in constants/Sidebar.js if it should appear in pill nav.
 *   3. Implement the matching method on the controller.
 *
 * `sidebar` is the SIDEBAR_ITEMS[].id this route activates.
 * `pill` is the path that should be highlighted in the pill nav (defaults to the route's path).
 */

/** @type {import("../framework/MenuPageRouter.js").Route[]} */
export const ROUTES = [
  // Auth
  { path: "/login", controller: "Auth", page: "index", loginRequired: false },

  // Guild
  { path: "/overview", controller: "Overview", page: "index", sidebar: "guild", loginRequired: true },
  { path: "/guild/details", controller: "GuildDetails", page: "index", sidebar: "guild", loginRequired: true },
  { path: "/guild/relationships", controller: "GuildRelationships", page: "index", sidebar: "guild", loginRequired: true },
  { path: "/guild/applications", controller: "MembershipApplications", page: "index", sidebar: "guild", loginRequired: true },
  { path: "/players", controller: "Players", page: "index", sidebar: "guild", pill: "/players", loginRequired: true },
  { path: "/players/bulk", controller: "Players", page: "bulk", sidebar: "guild", pill: "/players", loginRequired: true },
  { path: "/players/:id", controller: "PlayerProfile", page: "index", sidebar: "guild", pill: "/players", loginRequired: true },

  // Bank
  { path: "/guild/banks", controller: "Bank", page: "index", sidebar: "bank", loginRequired: true },
  { path: "/guild/mint-redeem", controller: "Bank", page: "mintRedeem", sidebar: "bank", loginRequired: true },

  // Energy
  { path: "/energy/reactors", controller: "Reactors", page: "index", sidebar: "energy", loginRequired: true },
  { path: "/energy/reactors/:id", controller: "ReactorProfile", page: "index", sidebar: "energy", pill: "/energy/reactors", loginRequired: true },
  { path: "/energy/substations", controller: "Substations", page: "index", sidebar: "energy", loginRequired: true },
  { path: "/energy/substations/:id", controller: "SubstationDetail", page: "index", sidebar: "energy", pill: "/energy/substations", loginRequired: true },
  { path: "/energy/grid", controller: "EnergyGrid", page: "index", sidebar: "energy", loginRequired: true },

  // Dashboards
  { path: "/alerts", controller: "Activity", page: "index", sidebar: "dashboards", loginRequired: true },
  { path: "/dashboards/metrics", controller: "Dashboards", page: "index", sidebar: "dashboards", loginRequired: true },

  // Settings
  { path: "/infrastructure", controller: "Infrastructure", page: "index", sidebar: "settings", loginRequired: true },

  // Dev gallery (only when STRUCTS_DEV_GALLERY=1; guarded in index.js)
  { path: "/dev/components", controller: "DevComponents", page: "index", loginRequired: false },
  { path: "/dev/tests", controller: "DevTests", page: "index", loginRequired: false },
];
