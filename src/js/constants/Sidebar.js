/**
 * Single source of truth for the sidebar. Sidebar.js + Routes.js together fully
 * describe the navigation graph -- the SidebarViewModel and PillNavViewModel
 * read from here, so adding a page is one edit per file.
 *
 * The brief mandates EXACTLY these 5 top-level items and these icons.
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   icon: string,
 *   defaultPath: string,
 *   pills?: Array<{ label: string, path: string }>,
 * }} SidebarItem
 */

/** @type {SidebarItem[]} */
export const SIDEBAR_ITEMS = [
  {
    id: "guild",
    label: "Guild",
    icon: "bi-x-diamond",
    defaultPath: "/overview",
    pills: [
      { label: "Overview", path: "/overview" },
      { label: "Details", path: "/guild/details" },
      { label: "Players", path: "/players" },
      { label: "Applications", path: "/guild/applications" },
      { label: "Agreements", path: "/guild/relationships" },
    ],
  },
  {
    id: "bank",
    label: "Bank",
    icon: "bi-piggy-bank",
    defaultPath: "/guild/banks",
    pills: [
      { label: "Guild Banks", path: "/guild/banks" },
      { label: "Mint / Redeem", path: "/guild/mint-redeem" },
    ],
  },
  {
    id: "energy",
    label: "Energy Market",
    icon: "bi-bar-chart-line",
    defaultPath: "/energy/reactors",
    pills: [
      { label: "Reactors", path: "/energy/reactors" },
      { label: "Substations", path: "/energy/substations" },
      { label: "Energy Grid", path: "/energy/grid" },
    ],
  },
  {
    id: "dashboards",
    label: "Dashboards",
    icon: "bi-graph-up",
    defaultPath: "/alerts",
    pills: [
      { label: "Activity", path: "/alerts" },
      { label: "Metrics", path: "/dashboards/metrics" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: "bi-toggle-off",
    defaultPath: "/infrastructure",
    pills: [{ label: "Infrastructure", path: "/infrastructure" }],
  },
];
