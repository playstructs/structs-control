/**
 * Structs protobuf message type URLs the admin SPA actually uses.
 *
 * Sourced from references/structs-webapp/src/js/managers/SigningClientManager.js.
 * Keep this list narrow to what an admin needs (guild settings, bank, players,
 * substations, allocations) -- not the full game tx surface.
 */
export const MSG_TYPES = Object.freeze({
  // Guild settings
  GUILD_UPDATE_NAME: "/structs.structs.MsgGuildUpdateName",
  GUILD_UPDATE_PFP: "/structs.structs.MsgGuildUpdatePfp",
  GUILD_UPDATE_ENDPOINT: "/structs.structs.MsgGuildUpdateEndpoint",
  GUILD_UPDATE_ENTRY_SUBSTATION_ID: "/structs.structs.MsgGuildUpdateEntrySubstationId",
  GUILD_UPDATE_ENTRY_RANK: "/structs.structs.MsgGuildUpdateEntryRank",
  GUILD_UPDATE_OWNER_ID: "/structs.structs.MsgGuildUpdateOwnerId",
  GUILD_UPDATE_JOIN_INFUSION_MINIMUM: "/structs.structs.MsgGuildUpdateJoinInfusionMinimum",
  GUILD_UPDATE_JOIN_INFUSION_MINIMUM_BYPASS_BY_REQUEST:
    "/structs.structs.MsgGuildUpdateJoinInfusionMinimumBypassByRequest",
  GUILD_UPDATE_JOIN_INFUSION_MINIMUM_BYPASS_BY_INVITE:
    "/structs.structs.MsgGuildUpdateJoinInfusionMinimumBypassByInvite",

  // Guild membership
  GUILD_MEMBERSHIP_KICK: "/structs.structs.MsgGuildMembershipKick",
  GUILD_MEMBERSHIP_INVITE_APPROVE: "/structs.structs.MsgGuildMembershipInviteApprove",
  GUILD_MEMBERSHIP_INVITE_DENY: "/structs.structs.MsgGuildMembershipInviteDeny",
  GUILD_MEMBERSHIP_REQUEST_APPROVE: "/structs.structs.MsgGuildMembershipRequestApprove",
  GUILD_MEMBERSHIP_REQUEST_DENY: "/structs.structs.MsgGuildMembershipRequestDeny",

  // Bank
  GUILD_BANK_MINT: "/structs.structs.MsgGuildBankMint",
  GUILD_BANK_REDEEM: "/structs.structs.MsgGuildBankRedeem",
  GUILD_BANK_CONFISCATE_AND_BURN: "/structs.structs.MsgGuildBankConfiscateAndBurn",

  // Player
  PLAYER_UPDATE_NAME: "/structs.structs.MsgPlayerUpdateName",
  PLAYER_UPDATE_PFP: "/structs.structs.MsgPlayerUpdatePfp",
  PLAYER_UPDATE_PFP_RENDER: "/structs.structs.MsgPlayerUpdatePfpClientRenderAttributes",
  PLAYER_UPDATE_GUILD_RANK: "/structs.structs.MsgPlayerUpdateGuildRank",

  // Substation
  SUBSTATION_PLAYER_CONNECT: "/structs.structs.MsgSubstationPlayerConnect",
  SUBSTATION_PLAYER_DISCONNECT: "/structs.structs.MsgSubstationPlayerDisconnect",
  SUBSTATION_PLAYER_MIGRATE: "/structs.structs.MsgSubstationPlayerMigrate",
  SUBSTATION_UPDATE_NAME: "/structs.structs.MsgSubstationUpdateName",
  SUBSTATION_UPDATE_PFP: "/structs.structs.MsgSubstationUpdatePfp",

  // Allocations
  ALLOCATION_CREATE: "/structs.structs.MsgAllocationCreate",
  ALLOCATION_UPDATE: "/structs.structs.MsgAllocationUpdate",
  ALLOCATION_DELETE: "/structs.structs.MsgAllocationDelete",
  ALLOCATION_TRANSFER: "/structs.structs.MsgAllocationTransfer",

  // Reactor
  REACTOR_INFUSE: "/structs.structs.MsgReactorInfuse",
  REACTOR_DEFUSE: "/structs.structs.MsgReactorDefuse",
  REACTOR_BEGIN_MIGRATION: "/structs.structs.MsgReactorBeginMigration",
});

/**
 * Default fee for admin operations. Adjust as needed once gas prices are known.
 */
export const DEFAULT_FEE = Object.freeze({
  amount: [],
  gas: "300000",
});
