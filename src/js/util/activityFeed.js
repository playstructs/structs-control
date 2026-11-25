import { MSG_TYPES } from "../constants/MessageTypes.js";
import { TX_STATUS } from "../constants/SigningQueueConstants.js";
import { entityLabel } from "./entityLookup.js";
import { entityRoute } from "./entityId.js";

/**
 * @typedef {{
 *   icon: import("../constants/ActivityIcons.js").ActivityIconKey | string,
 *   iconTone: "success" | "info" | "warning" | "error" | "neutral",
 *   title: string,
 *   time: string,
 *   body: string,
 *   actionLabel?: string,
 *   actionHref?: string,
 *   showDivider?: boolean,
 * }} ActivityFeedItem
 */

/**
 * Map queued/history txs into Figma Activity card rows.
 *
 * @param {import("../store/TxQueue.js").TxRecord[]} records
 * @param {import("./entityLookup.js").EntityLookup | null | undefined} [lookup]
 * @param {{ limit?: number }} [options]
 * @returns {Array<ActivityFeedItem & { _sortAt?: number, _priority?: number }>}
 */
export function txRecordsToActivityItems(records, lookup, options = {}) {
  const limit = options.limit ?? 6;
  const recent = [...(records ?? [])].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
  return recent.map((record, index) => {
    const item = describeTxActivity(record, lookup);
    return {
      ...item,
      time: formatActivityRelativeTime(record.updatedAt),
      showDivider: index < recent.length - 1,
      _sortAt: record.updatedAt,
    };
  });
}

/**
 * Map guild infusion rows into Figma Activity card rows (Alpha Infused / Alpha Defused).
 *
 * @param {Array<import("../types/api.js").InfusionData & { reactor_id?: string }>} infusions
 * @param {import("./entityLookup.js").EntityLookup | null | undefined} [lookup]
 * @param {{ limit?: number }} [options]
 * @returns {Array<ActivityFeedItem & { _sortAt?: number, _priority?: number }>}
 */
export function infusionRowsToActivityItems(infusions, lookup, options = {}) {
  const limit = options.limit ?? 6;
  const rows = Array.isArray(infusions) ? infusions : [];
  /** @type {Array<ActivityFeedItem & { _sortAt?: number, _priority?: number }>} */
  const items = [];

  for (const row of rows) {
    const reactorId = str(row.reactor_id ?? row.destination_id);
    if (!reactorId) continue;
    const reactor = labelEntity(reactorId, lookup) || reactorId;
    const playerId = str(row.player_id);
    const player = labelEntity(playerId, lookup) || playerId;
    const defusing = Boolean(row.defusing);
    const href = entityRoute(reactorId) ?? `/energy/reactors/${encodeURIComponent(reactorId)}`;

    // Infusions are current fuel state, not timestamped events, so they carry
    // no `_sortAt` — they render below timed activity, ordered by `_priority`.
    if (defusing) {
      items.push({
        icon: "alpha-defuse",
        iconTone: "error",
        title: "Alpha Defused",
        time: "Pending",
        body: player
          ? `Alpha defusing from ${reactor} (${player})`
          : `Alpha defusing from ${reactor}`,
        actionLabel: reactor,
        actionHref: href,
        _priority: 2,
      });
    } else {
      items.push({
        icon: "alpha-infuse",
        iconTone: "success",
        title: "Alpha Infused",
        time: "Active",
        body: player ? `Alpha infused into ${reactor} by ${player}` : `Alpha infused into ${reactor}`,
        actionLabel: reactor,
        actionHref: href,
        _priority: 1,
      });
    }
  }

  return items
    .sort((a, b) => (b._priority ?? 0) - (a._priority ?? 0) || (b._sortAt ?? 0) - (a._sortAt ?? 0))
    .slice(0, limit);
}

/**
 * Merge session txs + guild infusion activity for Overview / Activity pages.
 *
 * @param {import("../store/TxQueue.js").TxRecord[]} records
 * @param {Array<import("../types/api.js").InfusionData & { reactor_id?: string }>} infusions
 * @param {import("./entityLookup.js").EntityLookup | null | undefined} [lookup]
 * @param {{ limit?: number }} [options]
 * @returns {ActivityFeedItem[]}
 */
export function buildOverviewActivityItems(records, infusions, lookup, options = {}) {
  const limit = options.limit ?? 6;
  const txItems = txRecordsToActivityItems(records, lookup, { limit });
  const infusionItems = infusionRowsToActivityItems(infusions, lookup, { limit });

  const merged = [...txItems, ...infusionItems]
    .sort((a, b) => {
      const aTime = typeof a._sortAt === "number" ? a._sortAt : null;
      const bTime = typeof b._sortAt === "number" ? b._sortAt : null;
      // Timed activity (session txs) newest-first at the top.
      if (aTime != null && bTime != null) return bTime - aTime;
      // Timed activity ranks above untimed infusion state rows.
      if (aTime != null) return -1;
      if (bTime != null) return 1;
      // Both untimed: fall back to priority (defuse before infuse).
      return (b._priority ?? 0) - (a._priority ?? 0);
    })
    .slice(0, limit);

  return merged.map((item, index, arr) => ({
    icon: item.icon,
    iconTone: item.iconTone,
    title: item.title,
    time: item.time,
    body: item.body,
    actionLabel: item.actionLabel,
    actionHref: item.actionHref,
    showDivider: index < arr.length - 1,
  }));
}

/**
 * @param {import("../store/TxQueue.js").TxRecord} record
 * @param {import("./entityLookup.js").EntityLookup | null | undefined} [lookup]
 * @returns {Omit<ActivityFeedItem, "time" | "showDivider">}
 */
export function describeTxActivity(record, lookup) {
  const typeUrl = record.typeUrl ?? record.msg?.typeUrl ?? "";
  const value = /** @type {Record<string, unknown>} */ (record.msg?.value ?? {});
  const status = record.status;
  const failed = status === TX_STATUS.FAILED;
  const cancelled = status === TX_STATUS.CANCELLED;
  const pending = isPendingStatus(status);

  if (typeUrl === MSG_TYPES.SUBSTATION_PLAYER_MIGRATE) {
    const destId = str(value.substationId ?? value.substation_id);
    const dest = labelEntity(destId, lookup) || destId || "substation";
    const playerIds = asIdList(value.playerId ?? value.player_id ?? value.playerIds);
    const count = playerIds.length || 1;
    const players = `${count} player${count === 1 ? "" : "s"}`;
    return withStatusCopy(
      {
        icon: "sparkles",
        iconTone: "success",
        title: pending ? "Player migration queued" : "Players migrated",
        body: pending ? `Migrating ${players} to ${dest}` : `${players} were migrated to ${dest}`,
        actionLabel: destId ? `Go to ${dest}` : "Energy Grid",
        actionHref: destId ? `/energy/substations/${encodeURIComponent(destId)}` : "/energy/grid",
      },
      { failed, cancelled, pending, failureVerb: "migrate players" },
    );
  }

  if (typeUrl === MSG_TYPES.SUBSTATION_PLAYER_CONNECT) {
    const subId = str(value.substationId ?? value.substation_id);
    const playerId = str(value.playerId ?? value.player_id);
    const sub = labelEntity(subId, lookup) || subId || "substation";
    const player = labelEntity(playerId, lookup) || playerId || "Player";
    return withStatusCopy(
      {
        icon: "node-plus",
        iconTone: "success",
        title: "Player connected to substation",
        body: `${player} connected to ${sub}`,
        actionLabel: subId ? `Go to ${sub}` : undefined,
        actionHref: subId ? `/energy/substations/${encodeURIComponent(subId)}` : undefined,
      },
      { failed, cancelled, pending, failureVerb: "connect player" },
    );
  }

  if (typeUrl === MSG_TYPES.SUBSTATION_PLAYER_DISCONNECT) {
    const subId = str(value.substationId ?? value.substation_id);
    const playerId = str(value.playerId ?? value.player_id);
    const sub = labelEntity(subId, lookup) || subId || "substation";
    const player = labelEntity(playerId, lookup) || playerId || "Player";
    return withStatusCopy(
      {
        icon: "disconnect",
        iconTone: "error",
        title: "Player disconnected from substation",
        body: `${player} was disconnected from ${sub}`,
        actionLabel: subId ? `Go to ${sub}` : undefined,
        actionHref: subId ? `/energy/substations/${encodeURIComponent(subId)}` : undefined,
      },
      { failed, cancelled, pending, failureVerb: "disconnect player" },
    );
  }

  if (typeUrl === MSG_TYPES.ALLOCATION_CREATE) {
    const destId = str(value.destinationId ?? value.destination_id ?? value.sourceId ?? value.source_id);
    const dest = labelEntity(destId, lookup) || destId || "destination";
    return withStatusCopy(
      {
        icon: "node-plus",
        iconTone: "success",
        title: `Allocation created for ${dest}`,
        body: `Allocation was created for ${dest}`,
        actionLabel: destId ? dest : undefined,
        actionHref: destId ? entityRoute(destId) ?? "/energy/grid" : undefined,
      },
      { failed, cancelled, pending, failureVerb: "create allocation" },
    );
  }

  if (typeUrl === MSG_TYPES.ALLOCATION_DELETE) {
    const destId = str(value.destinationId ?? value.destination_id ?? value.sourceId ?? value.source_id);
    const dest = labelEntity(destId, lookup) || destId || "substation";
    return withStatusCopy(
      {
        icon: "disconnect",
        iconTone: "error",
        title: "Allocation disconnected from substation",
        body: `Allocation was disconnected from ${dest}`,
        actionLabel: destId ? `Go to ${dest}` : undefined,
        actionHref: destId ? entityRoute(destId) ?? "/energy/grid" : undefined,
      },
      { failed, cancelled, pending, failureVerb: "delete allocation" },
    );
  }

  if (typeUrl === MSG_TYPES.ALLOCATION_UPDATE || typeUrl === MSG_TYPES.ALLOCATION_TRANSFER) {
    return withStatusCopy(
      {
        icon: "settings",
        iconTone: "warning",
        title: "Allocation updated",
        body: "Allocation settings were recently changed",
        actionLabel: "Energy Grid",
        actionHref: "/energy/grid",
      },
      { failed, cancelled, pending, failureVerb: "update allocation" },
    );
  }

  if (typeUrl === MSG_TYPES.REACTOR_INFUSE) {
    const reactorId = resolveReactorId(value, lookup);
    const reactor = labelEntity(reactorId, lookup) || reactorId || "reactor";
    return withStatusCopy(
      {
        icon: "alpha-infuse",
        iconTone: "success",
        title: "Alpha Infused",
        body: `Alpha infused into ${reactor}`,
        actionLabel: reactorId ? reactor : "Reactors",
        actionHref: reactorId
          ? entityRoute(reactorId) ?? `/energy/reactors/${encodeURIComponent(reactorId)}`
          : "/energy/reactors",
      },
      { failed, cancelled, pending, failureVerb: "infuse alpha" },
    );
  }

  if (typeUrl === MSG_TYPES.REACTOR_DEFUSE) {
    const reactorId = resolveReactorId(value, lookup);
    const reactor = labelEntity(reactorId, lookup) || reactorId || "reactor";
    return withStatusCopy(
      {
        icon: "alpha-defuse",
        iconTone: "error",
        title: "Alpha Defused",
        body: `Alpha defused from ${reactor}`,
        actionLabel: reactorId ? reactor : "Reactors",
        actionHref: reactorId
          ? entityRoute(reactorId) ?? `/energy/reactors/${encodeURIComponent(reactorId)}`
          : "/energy/reactors",
      },
      { failed, cancelled, pending, failureVerb: "defuse alpha" },
    );
  }

  if (
    typeUrl === MSG_TYPES.GUILD_UPDATE_NAME ||
    typeUrl === MSG_TYPES.GUILD_UPDATE_PFP ||
    typeUrl === MSG_TYPES.GUILD_UPDATE_ENDPOINT ||
    typeUrl === MSG_TYPES.GUILD_UPDATE_ENTRY_SUBSTATION_ID ||
    typeUrl === MSG_TYPES.GUILD_UPDATE_ENTRY_RANK ||
    typeUrl === MSG_TYPES.GUILD_UPDATE_OWNER_ID ||
    typeUrl === MSG_TYPES.GUILD_UPDATE_JOIN_INFUSION_MINIMUM
  ) {
    return withStatusCopy(
      {
        icon: "settings",
        iconTone: "warning",
        title: "Guild settings changed",
        body: "Guild settings have changed",
        actionLabel: "Guild Management",
        actionHref: "/guild/details",
      },
      { failed, cancelled, pending, failureVerb: "update guild settings" },
    );
  }

  if (
    typeUrl === MSG_TYPES.GUILD_UPDATE_JOIN_INFUSION_MINIMUM_BYPASS_BY_REQUEST ||
    typeUrl === MSG_TYPES.GUILD_UPDATE_JOIN_INFUSION_MINIMUM_BYPASS_BY_INVITE
  ) {
    return withStatusCopy(
      {
        icon: "settings",
        iconTone: "warning",
        title: "Infusion bypass permissions",
        body: "Infusion bypass permissions has changed",
        actionLabel: "Guild Management",
        actionHref: "/guild/details",
      },
      { failed, cancelled, pending, failureVerb: "update permissions" },
    );
  }

  if (
    typeUrl === MSG_TYPES.GUILD_MEMBERSHIP_REQUEST_APPROVE ||
    typeUrl === MSG_TYPES.GUILD_MEMBERSHIP_INVITE_APPROVE
  ) {
    const playerId = str(value.playerId ?? value.player_id);
    const player = labelEntity(playerId, lookup) || playerId || "Player";
    const isInvite = typeUrl === MSG_TYPES.GUILD_MEMBERSHIP_INVITE_APPROVE;
    return withStatusCopy(
      {
        icon: isInvite ? "invite" : "check",
        iconTone: "success",
        title: isInvite ? "Invite accepted!" : "Request Accepted",
        body: isInvite ? `${player} has joined your guild` : `${player} request was accepted`,
        actionLabel: "Manage Memberships",
        actionHref: "/guild/applications",
      },
      { failed, cancelled, pending, failureVerb: "approve membership" },
    );
  }

  if (typeUrl === MSG_TYPES.GUILD_MEMBERSHIP_REQUEST_DENY || typeUrl === MSG_TYPES.GUILD_MEMBERSHIP_INVITE_DENY) {
    const playerId = str(value.playerId ?? value.player_id);
    const player = labelEntity(playerId, lookup) || playerId || "Player";
    return withStatusCopy(
      {
        icon: "disconnect",
        iconTone: "error",
        title: "Request denied",
        body: `${player} was denied membership`,
        actionLabel: "Manage Memberships",
        actionHref: "/guild/applications",
      },
      { failed, cancelled, pending, failureVerb: "deny membership" },
    );
  }

  if (typeUrl === MSG_TYPES.GUILD_MEMBERSHIP_KICK) {
    const playerId = str(value.playerId ?? value.player_id);
    const player = labelEntity(playerId, lookup) || playerId || "Player";
    return withStatusCopy(
      {
        icon: "request",
        iconTone: "error",
        title: "Player removed",
        body: `${player} was removed from the guild`,
        actionLabel: "Manage Memberships",
        actionHref: "/guild/applications",
      },
      { failed, cancelled, pending, failureVerb: "remove player" },
    );
  }

  if (
    typeUrl === MSG_TYPES.GUILD_BANK_MINT ||
    typeUrl === MSG_TYPES.GUILD_BANK_REDEEM ||
    typeUrl === MSG_TYPES.GUILD_BANK_CONFISCATE_AND_BURN
  ) {
    const verb =
      typeUrl === MSG_TYPES.GUILD_BANK_MINT
        ? "minted"
        : typeUrl === MSG_TYPES.GUILD_BANK_REDEEM
          ? "redeemed"
          : "confiscated";
    return withStatusCopy(
      {
        icon: typeUrl === MSG_TYPES.GUILD_BANK_CONFISCATE_AND_BURN ? "disconnect" : "check",
        iconTone: typeUrl === MSG_TYPES.GUILD_BANK_CONFISCATE_AND_BURN ? "error" : "success",
        title: typeUrl === MSG_TYPES.GUILD_BANK_MINT ? "Guild bank mint" : typeUrl === MSG_TYPES.GUILD_BANK_REDEEM ? "Guild bank redeem" : "Guild bank confiscate",
        body: `Tokens were ${verb} from the guild bank`,
        actionLabel: "Bank",
        actionHref: "/guild/banks",
      },
      { failed, cancelled, pending, failureVerb: "update bank" },
    );
  }

  if (
    typeUrl === MSG_TYPES.PLAYER_UPDATE_NAME ||
    typeUrl === MSG_TYPES.PLAYER_UPDATE_PFP ||
    typeUrl === MSG_TYPES.PLAYER_UPDATE_PFP_RENDER ||
    typeUrl === MSG_TYPES.PLAYER_UPDATE_GUILD_RANK
  ) {
    const playerId = str(value.playerId ?? value.player_id);
    const player = labelEntity(playerId, lookup) || playerId || "Player";
    return withStatusCopy(
      {
        icon: "settings",
        iconTone: "info",
        title: "Player updated",
        body: `${player} profile was updated`,
        actionLabel: playerId ? `Go to ${player}` : "Players",
        actionHref: playerId ? `/players/${encodeURIComponent(playerId)}` : "/players",
      },
      { failed, cancelled, pending, failureVerb: "update player" },
    );
  }

  if (typeUrl === MSG_TYPES.SUBSTATION_UPDATE_NAME || typeUrl === MSG_TYPES.SUBSTATION_UPDATE_PFP) {
    const subId = str(value.substationId ?? value.substation_id ?? value.id);
    const sub = labelEntity(subId, lookup) || subId || "Substation";
    return withStatusCopy(
      {
        icon: "settings",
        iconTone: "warning",
        title: "Substation updated",
        body: `${sub} was recently changed`,
        actionLabel: subId ? `Go to ${sub}` : "Energy Grid",
        actionHref: subId ? `/energy/substations/${encodeURIComponent(subId)}` : "/energy/grid",
      },
      { failed, cancelled, pending, failureVerb: "update substation" },
    );
  }

  const shortType = humanizeTypeUrl(typeUrl);
  return withStatusCopy(
    {
      icon: pending ? "node-plus" : "sparkles",
      iconTone: pending ? "info" : "neutral",
      title: shortType,
      body: statusSentence(status, record.error),
      actionLabel: "See all activities",
      actionHref: "/alerts",
    },
    { failed, cancelled, pending, failureVerb: "complete this action" },
  );
}

/**
 * @param {Omit<ActivityFeedItem, "time" | "showDivider">} base
 * @param {{ failed: boolean, cancelled: boolean, pending: boolean, failureVerb: string }} flags
 */
function withStatusCopy(base, flags) {
  if (flags.failed) {
    return {
      ...base,
      icon: "disconnect",
      iconTone: /** @type {const} */ ("error"),
      title: base.title.endsWith("failed") ? base.title : `${base.title} failed`,
      body: `Failed to ${flags.failureVerb}. ${base.body}`,
    };
  }
  if (flags.cancelled) {
    return {
      ...base,
      icon: "disconnect",
      iconTone: /** @type {const} */ ("neutral"),
      title: `${base.title} cancelled`,
      body: `Cancelled before broadcast. ${base.body}`,
    };
  }
  if (flags.pending) {
    return {
      ...base,
      iconTone: base.iconTone === "error" ? "warning" : base.iconTone,
    };
  }
  return base;
}

/** @param {import("../constants/SigningQueueConstants.js").TxStatus} status */
function isPendingStatus(status) {
  return (
    status === TX_STATUS.PENDING ||
    status === TX_STATUS.SIGNING ||
    status === TX_STATUS.CONFIRMING
  );
}

/**
 * Infuse/defuse msgs carry validatorAddress, not reactorId — resolve via catalog.
 * @param {Record<string, unknown>} value
 * @param {import("./entityLookup.js").EntityLookup | null | undefined} lookup
 */
function resolveReactorId(value, lookup) {
  const direct = str(value.reactorId ?? value.reactor_id ?? value.destinationId ?? value.destination_id);
  if (direct) return direct;
  const validator = str(value.validatorAddress ?? value.validator_address);
  if (!validator || !lookup?.reactors) return "";
  for (const [id, reactor] of lookup.reactors) {
    const candidate = str(
      reactor.validator ?? /** @type {{ validator_address?: string }} */ (reactor).validator_address,
    );
    if (candidate && candidate === validator) return id;
  }
  return "";
}

/** @param {unknown} value */
function str(value) {
  if (value == null || value === "") return "";
  return String(value);
}

/** @param {unknown} value */
function asIdList(value) {
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
  if (value == null || value === "") return [];
  return [str(value)];
}

/**
 * Prefer human name only for activity copy (Figma uses "Battlestar 12", not "Name (id)").
 * @param {string} id
 * @param {import("./entityLookup.js").EntityLookup | null | undefined} lookup
 */
function labelEntity(id, lookup) {
  if (!id) return "";
  const full = entityLabel(id, lookup);
  if (!full || full === "—") return "";
  const match = full.match(/^(.*) \(.+\)$/);
  return (match ? match[1] : full).trim() || id;
}

/** @param {string} typeUrl */
function humanizeTypeUrl(typeUrl) {
  const leaf = String(typeUrl).replace(/^.*\./, "").replace(/^Msg/, "");
  return leaf
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim() || "Activity";
}

/**
 * @param {import("../constants/SigningQueueConstants.js").TxStatus} status
 * @param {string | undefined} error
 */
function statusSentence(status, error) {
  if (status === TX_STATUS.FAILED) return error || "Transaction failed";
  if (status === TX_STATUS.CANCELLED) return "Transaction cancelled";
  if (status === TX_STATUS.CONFIRMED) return "Transaction confirmed";
  if (status === TX_STATUS.CONFIRMING) return "Waiting for confirmation";
  if (status === TX_STATUS.SIGNING) return "Broadcasting transaction";
  return "Queued for broadcast";
}

/** @param {number} ts */
export function formatActivityRelativeTime(ts) {
  const delta = Date.now() - ts;
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}hrs ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
