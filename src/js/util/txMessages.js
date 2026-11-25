// @ts-nocheck
/**
 * Build cosmjs EncodeObject payloads using Structs protobuf types.
 * Creator is always the signing address (session.address).
 *
 * uint64/int64 fields must stay exact decimal strings through encode (v0.22
 * migration). Prefer `exactUint64()` over Number() for wire amounts.
 */

import {
  MsgGuildBankMint,
  MsgGuildBankRedeem,
  MsgGuildBankConfiscateAndBurn,
  MsgGuildMembershipKick,
  MsgGuildMembershipInviteApprove,
  MsgGuildMembershipInviteDeny,
  MsgGuildMembershipRequestApprove,
  MsgGuildMembershipRequestDeny,
  MsgPlayerUpdateName,
  MsgPlayerUpdatePfp,
  MsgPlayerUpdatePfpClientRenderAttributes,
  MsgAllocationCreate,
  MsgAllocationUpdate,
  MsgAllocationDelete,
  MsgReactorInfuse,
  MsgReactorDefuse,
  MsgSubstationPlayerMigrate,
  MsgPermissionSetOnObject,
  MsgPermissionGrantOnObject,
  MsgPermissionRevokeOnObject,
  MsgVaultSend,
} from "../ts/structs.structs/types/structs/structs/tx.js";
import { MsgSubstationUpdateConnectionCapacityMaximum } from "../ts/structs.structs/types/structs/structs/MsgSubstationUpdateConnectionCapacityMaximum.js";
import { allocationTypeFromJSON } from "../ts/structs.structs/types/structs/structs/keys.js";
import { MSG_TYPES } from "../constants/MessageTypes.js";
import { alphaToUalpha } from "./alpha.js";
import { isUint64 } from "./ExactInteger.js";
import { normalizeMessagePayload } from "./MessagePayload.js";

/**
 * @param {string} creator
 * @returns {string}
 */
function creatorOrThrow(creator) {
  if (!creator) throw new Error("Signing address unavailable");
  return creator;
}

/**
 * Canonical uint64 decimal string for protobuf wire fields.
 * @param {string | number | bigint} value
 * @param {string} [field]
 * @returns {string}
 */
export function exactUint64(value, field = "amount") {
  if (typeof value === "bigint") {
    const s = value.toString();
    if (!isUint64(s)) throw new Error(`Invalid exact uint64 at ${field}`);
    return s;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid exact uint64 at ${field}`);
    }
    return String(value);
  }
  const s = String(value ?? "").trim();
  if (!isUint64(s)) throw new Error(`Invalid exact uint64 at ${field}`);
  return s;
}

/**
 * Normalize + encode a Structs message for the tx queue.
 * @param {string} typeUrl
 * @param {Record<string, unknown>} value
 * @returns {{ typeUrl: string, value: any }}
 */
function encodeMessage(typeUrl, value) {
  return { typeUrl, value: normalizeMessagePayload(typeUrl, value) };
}

/**
 * @param {{
 *   creator: string,
 *   amountAlpha: string | number,
 *   amountToken: string | number,
 *   guildId?: string,
 * }} body
 */
export function buildGuildBankMint(body) {
  return encodeMessage(MSG_TYPES.GUILD_BANK_MINT, MsgGuildBankMint.fromPartial({
    creator: creatorOrThrow(body.creator),
    amountAlpha: exactUint64(body.amountAlpha, "amountAlpha"),
    amountToken: exactUint64(body.amountToken, "amountToken"),
    guildId: body.guildId ? String(body.guildId) : "",
  }));
}

/**
 * @param {{ creator: string, amount: string, denom: string, minAmountAlpha?: string | number }} body
 */
export function buildGuildBankRedeem(body) {
  return encodeMessage(MSG_TYPES.GUILD_BANK_REDEEM, MsgGuildBankRedeem.fromPartial({
    creator: creatorOrThrow(body.creator),
    amountToken: { amount: exactUint64(body.amount, "amount"), denom: body.denom },
    minAmountAlpha: exactUint64(body.minAmountAlpha ?? 0, "minAmountAlpha"),
  }));
}

/**
 * @param {{
 *   creator: string,
 *   fromAddress: string,
 *   amountToken: string | number,
 *   guildId?: string,
 * }} body
 */
export function buildGuildBankConfiscateAndBurn(body) {
  return encodeMessage(MSG_TYPES.GUILD_BANK_CONFISCATE_AND_BURN, MsgGuildBankConfiscateAndBurn.fromPartial({
    creator: creatorOrThrow(body.creator),
    address: body.fromAddress,
    amountToken: exactUint64(body.amountToken, "amountToken"),
    guildId: body.guildId ? String(body.guildId) : "",
  }));
}

/**
 * @param {{ creator: string, guildId: string, playerId: string }} body
 */
export function buildGuildMembershipKick(body) {
  return encodeMessage(MSG_TYPES.GUILD_MEMBERSHIP_KICK, MsgGuildMembershipKick.fromPartial({
    creator: creatorOrThrow(body.creator),
    guildId: body.guildId,
    playerId: body.playerId,
  }));
}

/**
 * @param {{ creator: string, playerId: string, name: string }} body
 */
export function buildPlayerUpdateName(body) {
  return encodeMessage(MSG_TYPES.PLAYER_UPDATE_NAME, MsgPlayerUpdateName.fromPartial({
    creator: creatorOrThrow(body.creator),
    playerId: body.playerId,
    name: body.name,
  }));
}

/**
 * @param {{ creator: string, playerId: string, pfp: string }} body
 */
export function buildPlayerUpdatePfp(body) {
  return encodeMessage(MSG_TYPES.PLAYER_UPDATE_PFP, MsgPlayerUpdatePfp.fromPartial({
    creator: creatorOrThrow(body.creator),
    playerId: body.playerId,
    pfp: body.pfp,
  }));
}

/**
 * @param {{ creator: string, playerId: string, pfpClientRenderAttributes: string }} body
 */
export function buildPlayerUpdatePfpRender(body) {
  return encodeMessage(
    MSG_TYPES.PLAYER_UPDATE_PFP_RENDER,
    MsgPlayerUpdatePfpClientRenderAttributes.fromPartial({
      creator: creatorOrThrow(body.creator),
      playerId: body.playerId,
      pfpClientRenderAttributes: body.pfpClientRenderAttributes,
    }),
  );
}

/**
 * Approve or deny a membership application based on joinType.
 * @param {{
 *   creator: string,
 *   guildId: string,
 *   playerId: string,
 *   substationId: string,
 *   joinType: string | number,
 *   approve: boolean,
 * }} body
 */
export function buildMembershipApplicationAction(body) {
  const creator = creatorOrThrow(body.creator);
  const joinType = String(body.joinType ?? "").toLowerCase();
  const isInvite = joinType.includes("invite");

  if (body.approve) {
    const typeUrl = isInvite
      ? MSG_TYPES.GUILD_MEMBERSHIP_INVITE_APPROVE
      : MSG_TYPES.GUILD_MEMBERSHIP_REQUEST_APPROVE;
    const value = isInvite
      ? MsgGuildMembershipInviteApprove.fromPartial({
          creator,
          guildId: body.guildId,
          playerId: body.playerId,
          substationId: body.substationId,
        })
      : MsgGuildMembershipRequestApprove.fromPartial({
          creator,
          guildId: body.guildId,
          playerId: body.playerId,
          substationId: body.substationId,
        });
    return encodeMessage(typeUrl, value);
  }

  const typeUrl = isInvite
    ? MSG_TYPES.GUILD_MEMBERSHIP_INVITE_DENY
    : MSG_TYPES.GUILD_MEMBERSHIP_REQUEST_DENY;
  const value = isInvite
    ? MsgGuildMembershipInviteDeny.fromPartial({
        creator,
        guildId: body.guildId,
        playerId: body.playerId,
      })
    : MsgGuildMembershipRequestDeny.fromPartial({
        creator,
        guildId: body.guildId,
        playerId: body.playerId,
      });
  return encodeMessage(typeUrl, value);
}

/**
 * @param {{
 *   creator: string,
 *   sourceObjectId: string,
 *   controller: string,
 *   allocationType: string,
 *   power: string | number,
 * }} body
 */
export function buildAllocationCreate(body) {
  return encodeMessage(MSG_TYPES.ALLOCATION_CREATE, MsgAllocationCreate.fromPartial({
    creator: creatorOrThrow(body.creator),
    sourceObjectId: body.sourceObjectId,
    controller: body.controller,
    allocationType: allocationTypeFromJSON(body.allocationType),
    power: exactUint64(body.power, "power"),
  }));
}

/**
 * @param {{ creator: string, allocationId: string, power: string | number }} body
 */
export function buildAllocationUpdate(body) {
  return encodeMessage(MSG_TYPES.ALLOCATION_UPDATE, MsgAllocationUpdate.fromPartial({
    creator: creatorOrThrow(body.creator),
    allocationId: body.allocationId,
    power: exactUint64(body.power, "power"),
  }));
}

/**
 * @param {{ creator: string, allocationId: string }} body
 */
export function buildAllocationDelete(body) {
  return encodeMessage(MSG_TYPES.ALLOCATION_DELETE, MsgAllocationDelete.fromPartial({
    creator: creatorOrThrow(body.creator),
    allocationId: body.allocationId,
  }));
}

/**
 * @param {{
 *   creator: string,
 *   delegatorAddress: string,
 *   validatorAddress: string,
 *   amountAlpha: string | number,
 *   ownerId?: string,
 * }} body
 */
export function buildReactorInfuse(body) {
  return encodeMessage(MSG_TYPES.REACTOR_INFUSE, MsgReactorInfuse.fromPartial({
    creator: creatorOrThrow(body.creator),
    delegatorAddress: body.delegatorAddress,
    validatorAddress: body.validatorAddress,
    amount: { denom: "ualpha", amount: alphaToUalpha(body.amountAlpha) },
    ownerId: body.ownerId ? String(body.ownerId) : "",
  }));
}

/**
 * @param {{
 *   creator: string,
 *   delegatorAddress: string,
 *   validatorAddress: string,
 *   amountAlpha: string | number,
 * }} body
 */
export function buildReactorDefuse(body) {
  return encodeMessage(MSG_TYPES.REACTOR_DEFUSE, MsgReactorDefuse.fromPartial({
    creator: creatorOrThrow(body.creator),
    delegatorAddress: body.delegatorAddress,
    validatorAddress: body.validatorAddress,
    amount: { denom: "ualpha", amount: alphaToUalpha(body.amountAlpha) },
  }));
}

/**
 * @param {{ creator: string, substationId: string, playerIds: string[] }} body
 */
export function buildSubstationPlayerMigrate(body) {
  const playerIds = (body.playerIds ?? []).map(String).filter(Boolean);
  if (!playerIds.length) throw new Error("At least one player is required for migration");
  return encodeMessage(MSG_TYPES.SUBSTATION_PLAYER_MIGRATE, MsgSubstationPlayerMigrate.fromPartial({
    creator: creatorOrThrow(body.creator),
    substationId: body.substationId,
    playerId: playerIds,
  }));
}

/**
 * Cap per-player connection draw on a substation (structsd v0.23.0).
 * Pass `0` to remove the cap.
 *
 * @param {{ creator: string, substationId: string, connectionCapacityMaximum: string | number }} body
 */
export function buildSubstationUpdateConnectionCapacityMaximum(body) {
  return encodeMessage(
    MSG_TYPES.SUBSTATION_UPDATE_CONNECTION_CAPACITY_MAXIMUM,
    MsgSubstationUpdateConnectionCapacityMaximum.fromPartial({
      creator: creatorOrThrow(body.creator),
      substationId: body.substationId,
      connectionCapacityMaximum: exactUint64(
        body.connectionCapacityMaximum,
        "connectionCapacityMaximum",
      ),
    }),
  );
}

/**
 * Move liquid balances between player/guild vaults (structsd v0.22.0).
 *
 * @param {{
 *   creator: string,
 *   ownerId: string,
 *   recipientOwnerId: string,
 *   amount: Array<{ denom: string, amount: string }>,
 * }} body
 */
export function buildVaultSend(body) {
  return encodeMessage(MSG_TYPES.VAULT_SEND, MsgVaultSend.fromPartial({
    creator: creatorOrThrow(body.creator),
    ownerId: String(body.ownerId),
    recipientOwnerId: String(body.recipientOwnerId),
    amount: (body.amount ?? []).map((c) => ({
      denom: String(c.denom),
      amount: exactUint64(c.amount, "amount"),
    })),
  }));
}

/**
 * @param {{ creator: string, objectId: string, playerId: string, permissions: string | number }} body
 */
export function buildPermissionSetOnObject(body) {
  return encodeMessage(MSG_TYPES.PERMISSION_SET_ON_OBJECT, MsgPermissionSetOnObject.fromPartial({
    creator: creatorOrThrow(body.creator),
    objectId: String(body.objectId),
    playerId: String(body.playerId),
    permissions: exactUint64(body.permissions ?? 0, "permissions"),
  }));
}

/**
 * @param {{ creator: string, objectId: string, playerId: string, permissions: string | number }} body
 */
export function buildPermissionGrantOnObject(body) {
  return encodeMessage(MSG_TYPES.PERMISSION_GRANT_ON_OBJECT, MsgPermissionGrantOnObject.fromPartial({
    creator: creatorOrThrow(body.creator),
    objectId: String(body.objectId),
    playerId: String(body.playerId),
    permissions: exactUint64(body.permissions ?? 0, "permissions"),
  }));
}

/**
 * @param {{ creator: string, objectId: string, playerId: string, permissions: string | number }} body
 */
export function buildPermissionRevokeOnObject(body) {
  return encodeMessage(MSG_TYPES.PERMISSION_REVOKE_ON_OBJECT, MsgPermissionRevokeOnObject.fromPartial({
    creator: creatorOrThrow(body.creator),
    objectId: String(body.objectId),
    playerId: String(body.playerId),
    permissions: exactUint64(body.permissions ?? 0, "permissions"),
  }));
}

