/**
 * Figma Activity panel icons (Factions-Admin-Flows node 1534:34881).
 * Exported as webpack asset URLs for <img> usage.
 */
import disconnectUrl from "../../assets/activity-icons/disconnect.svg";
import nodePlusUrl from "../../assets/activity-icons/node-plus.svg";
import sparklesUrl from "../../assets/activity-icons/sparkles.svg";
import settingsUrl from "../../assets/activity-icons/settings.svg";
import alphaInfuseUrl from "../../assets/activity-icons/alpha-infuse.svg";
import alphaDefuseUrl from "../../assets/activity-icons/alpha-defuse.svg";
import checkUrl from "../../assets/activity-icons/check.svg";
import inviteUrl from "../../assets/activity-icons/invite.svg";
import requestUrl from "../../assets/activity-icons/request.svg";

/** @typedef {keyof typeof ACTIVITY_ICONS} ActivityIconKey */

export const ACTIVITY_ICONS = Object.freeze({
  disconnect: disconnectUrl,
  "node-plus": nodePlusUrl,
  sparkles: sparklesUrl,
  settings: settingsUrl,
  "alpha-infuse": alphaInfuseUrl,
  "alpha-defuse": alphaDefuseUrl,
  check: checkUrl,
  invite: inviteUrl,
  request: requestUrl,
});

/**
 * @param {string | undefined} key
 * @returns {string}
 */
export function activityIconUrl(key) {
  if (key && key in ACTIVITY_ICONS) return ACTIVITY_ICONS[/** @type {ActivityIconKey} */ (key)];
  return "";
}
