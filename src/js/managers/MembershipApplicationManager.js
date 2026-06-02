import { keys } from "../store/keys.js";
import { buildMembershipApplicationAction } from "../util/txMessages.js";

export class MembershipApplicationManager {
  /**
   * @param {{ store: import("../store/Store.js").Store, guildAPI: import("../api/GuildAPI.js").GuildAPI }} deps
   */
  constructor(deps) {
    this.store = deps.store;
    this.guildAPI = deps.guildAPI;
  }

  _creator() {
    return this.store.session?.data?.address ?? "";
  }

  /** @param {string} guildId */
  fetchByGuild(guildId) {
    return this.store.query(keys.membershipApplications(guildId), () =>
      this.guildAPI.getMembershipApplicationsByGuild(guildId),
    );
  }

  /**
   * @param {import("../types/api.js").MembershipApplicationData} application
   * @param {boolean} approve
   */
  buildActionMessage(application, approve) {
    return buildMembershipApplicationAction({
      creator: this._creator(),
      guildId: String(application.guild_id ?? application.guildId ?? ""),
      playerId: String(application.player_id ?? application.playerId ?? ""),
      substationId: String(application.substation_id ?? application.substationId ?? ""),
      joinType: application.join_type ?? application.joinType ?? "request",
      approve,
    });
  }
}
