// @ts-nocheck
/**
 * Build cosmjs EncodeObject payloads using Structs protobuf types.
 * Creator is always the signing address (session.address).
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
} from "../ts/structs.structs/types/structs/structs/tx.js";
import { allocationTypeFromJSON } from "../ts/structs.structs/types/structs/structs/keys.js";
import { MSG_TYPES } from "../constants/MessageTypes.js";
import { alphaToUalpha } from "./alpha.js";

/**
 * @param {string} creator
 * @returns {string}
 */
function creatorOrThrow(creator) {
  if (!creator) throw new Error("Signing address unavailable");
  return creator;
}

/**
 * @param {{ creator: string, amountAlpha: string | number, amountToken: string | number }} body
 */
export function buildGuildBankMint(body) {
  return {
    typeUrl: MSG_TYPES.GUILD_BANK_MINT,
    value: MsgGuildBankMint.fromPartial({
      creator: creatorOrThrow(body.creator),
      amountAlpha: Number(body.amountAlpha),
      amountToken: Number(body.amountToken),
    }),
  };
}

/**
 * @param {{ creator: string, amount: string, denom: string }} body
 */
export function buildGuildBankRedeem(body) {
  return {
    typeUrl: MSG_TYPES.GUILD_BANK_REDEEM,
    value: MsgGuildBankRedeem.fromPartial({
      creator: creatorOrThrow(body.creator),
      amountToken: { amount: body.amount, denom: body.denom },
    }),
  };
}

/**
 * @param {{ creator: string, fromAddress: string, amountToken: string | number }} body
 */
export function buildGuildBankConfiscateAndBurn(body) {
  return {
    typeUrl: MSG_TYPES.GUILD_BANK_CONFISCATE_AND_BURN,
    value: MsgGuildBankConfiscateAndBurn.fromPartial({
      creator: creatorOrThrow(body.creator),
      address: body.fromAddress,
      amountToken: Number(body.amountToken),
    }),
  };
}

/**
 * @param {{ creator: string, guildId: string, playerId: string }} body
 */
export function buildGuildMembershipKick(body) {
  return {
    typeUrl: MSG_TYPES.GUILD_MEMBERSHIP_KICK,
    value: MsgGuildMembershipKick.fromPartial({
      creator: creatorOrThrow(body.creator),
      guildId: body.guildId,
      playerId: body.playerId,
    }),
  };
}

/**
 * @param {{ creator: string, playerId: string, name: string }} body
 */
export function buildPlayerUpdateName(body) {
  return {
    typeUrl: MSG_TYPES.PLAYER_UPDATE_NAME,
    value: MsgPlayerUpdateName.fromPartial({
      creator: creatorOrThrow(body.creator),
      playerId: body.playerId,
      name: body.name,
    }),
  };
}

/**
 * @param {{ creator: string, playerId: string, pfp: string }} body
 */
export function buildPlayerUpdatePfp(body) {
  return {
    typeUrl: MSG_TYPES.PLAYER_UPDATE_PFP,
    value: MsgPlayerUpdatePfp.fromPartial({
      creator: creatorOrThrow(body.creator),
      playerId: body.playerId,
      pfp: body.pfp,
    }),
  };
}

/**
 * @param {{ creator: string, playerId: string, pfpClientRenderAttributes: string }} body
 */
export function buildPlayerUpdatePfpRender(body) {
  return {
    typeUrl: MSG_TYPES.PLAYER_UPDATE_PFP_RENDER,
    value: MsgPlayerUpdatePfpClientRenderAttributes.fromPartial({
      creator: creatorOrThrow(body.creator),
      playerId: body.playerId,
      pfpClientRenderAttributes: body.pfpClientRenderAttributes,
    }),
  };
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
    const typeUrl = isInvite ? MSG_TYPES.GUILD_MEMBERSHIP_INVITE_APPROVE : MSG_TYPES.GUILD_MEMBERSHIP_REQUEST_APPROVE;
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
    return { typeUrl, value };
  }

  const typeUrl = isInvite ? MSG_TYPES.GUILD_MEMBERSHIP_INVITE_DENY : MSG_TYPES.GUILD_MEMBERSHIP_REQUEST_DENY;
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
  return { typeUrl, value };
}

/**
 * @param {{
 *   creator: string,
 *   controller: string,
 *   sourceObjectId: string,
 *   allocationType: string,
 *   power: string | number,
 * }} body
 */
export function buildAllocationCreate(body) {
  return {
    typeUrl: MSG_TYPES.ALLOCATION_CREATE,
    value: MsgAllocationCreate.fromPartial({
      creator: creatorOrThrow(body.creator),
      controller: body.controller,
      sourceObjectId: body.sourceObjectId,
      allocationType: allocationTypeFromJSON(body.allocationType),
      power: Number(body.power),
    }),
  };
}

/**
 * @param {{ creator: string, allocationId: string, power: string | number }} body
 */
export function buildAllocationUpdate(body) {
  return {
    typeUrl: MSG_TYPES.ALLOCATION_UPDATE,
    value: MsgAllocationUpdate.fromPartial({
      creator: creatorOrThrow(body.creator),
      allocationId: body.allocationId,
      power: Number(body.power),
    }),
  };
}

/**
 * @param {{ creator: string, allocationId: string }} body
 */
export function buildAllocationDelete(body) {
  return {
    typeUrl: MSG_TYPES.ALLOCATION_DELETE,
    value: MsgAllocationDelete.fromPartial({
      creator: creatorOrThrow(body.creator),
      allocationId: body.allocationId,
    }),
  };
}

/**
 * @param {{
 *   creator: string,
 *   delegatorAddress: string,
 *   validatorAddress: string,
 *   amountAlpha: string | number,
 * }} body
 */
export function buildReactorInfuse(body) {
  return {
    typeUrl: MSG_TYPES.REACTOR_INFUSE,
    value: MsgReactorInfuse.fromPartial({
      creator: creatorOrThrow(body.creator),
      delegatorAddress: body.delegatorAddress,
      validatorAddress: body.validatorAddress,
      amount: { denom: "ualpha", amount: alphaToUalpha(body.amountAlpha) },
    }),
  };
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
  return {
    typeUrl: MSG_TYPES.REACTOR_DEFUSE,
    value: MsgReactorDefuse.fromPartial({
      creator: creatorOrThrow(body.creator),
      delegatorAddress: body.delegatorAddress,
      validatorAddress: body.validatorAddress,
      amount: { denom: "ualpha", amount: alphaToUalpha(body.amountAlpha) },
    }),
  };
}
