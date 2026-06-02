/**
 * Guild API client. Wraps every endpoint we use in a method that returns the
 * envelope's `data`. Errors raise `GuildAPIError` via JsonAjaxer.
 *
 * Catalog reads use `/api/{entity}/.../page/{page}` per Symfony `CatalogReadController`.
 * `data` is a flat row array (page size 100). See `references/structs-webapp/src/src/Controller/`.
 */

import { JsonAjaxer } from "../framework/JsonAjaxer.js";
import { GuildAPIError } from "../errors/GuildAPIError.js";
import { fetchAllCatalogPages, fetchCatalogList, fetchCatalogPage } from "./catalogPage.js";

export class GuildAPI {
  /**
   * @param {{ baseUrl?: string }} [options]
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl ?? "/api";
    this.ajax = new JsonAjaxer({ baseUrl: this.baseUrl });

    const optional = [
      "/reactor/guild/",
      "/reactor/all/page/",
      "/allocation/all/page/",
      "/substation/all/page/",
      "/guild/this",
      "/infusion/list/destination/",
      "/player/list/substation/",
      "/guild-membership-application/",
      "/provider/",
      "/agreement/",
      "/stat/",
    ];
    for (const p of optional) this.ajax.registerOptional(p);
  }

  // -- Auth + bootstrap -------------------------------------------------------

  /** @returns {Promise<string>} unix timestamp string */
  async getTimestamp() {
    const data = await this.ajax.get(`/timestamp`);
    return String(data?.unix_timestamp ?? "");
  }

  /**
   * @param {string} address
   * @param {string} guildId
   * @returns {Promise<string>}
   */
  async getPlayerIdByAddressAndGuild(address, guildId) {
    const data = await this.ajax.get(
      `/auth/player-address/${encodeURIComponent(address)}/guild/${encodeURIComponent(guildId)}/player-id`,
    );
    return String(data?.player_id ?? "");
  }

  /**
   * @param {{ address: string, pubkey: string, guild_id: string, unix_timestamp: string, signature: string }} body
   */
  async login(body) {
    return await this.ajax.post(`/auth/login`, body);
  }

  async logout() {
    return await this.ajax.get(`/auth/logout`);
  }

  // -- Guild ------------------------------------------------------------------

  async getThisGuild() {
    return /** @type {import("../types/api.js").GuildData} */ (await this.ajax.get(`/guild/this`));
  }

  /** @param {string} guildId */
  async getGuild(guildId) {
    return /** @type {import("../types/api.js").GuildData} */ (
      await this.ajax.get(`/guild/${encodeURIComponent(guildId)}`)
    );
  }

  /** @param {string} guildId */
  async getGuildRoster(guildId) {
    return /** @type {import("../types/api.js").PlayerData[]} */ (
      await this.ajax.get(`/guild/${encodeURIComponent(guildId)}/roster`)
    );
  }

  /** @param {string} guildId */
  async countGuildMembers(guildId) {
    const data = await this.ajax.get(`/guild/${encodeURIComponent(guildId)}/members/count`);
    return parseInt(String(data?.count ?? "0"), 10);
  }

  /** @param {string} guildId */
  async getGuildPowerStats(guildId) {
    return await this.ajax.get(`/guild/${encodeURIComponent(guildId)}/power/stats`);
  }

  async getSettings() {
    return await this.ajax.get(`/setting`);
  }

  // -- Player -----------------------------------------------------------------

  /** @param {string} playerId */
  async getPlayer(playerId) {
    return /** @type {import("../types/api.js").PlayerData} */ (
      await this.ajax.get(`/player/${encodeURIComponent(playerId)}`)
    );
  }

  /** @param {string} playerId */
  async getPlayerAddressList(playerId) {
    return await this.ajax.get(`/player-address/player/${encodeURIComponent(playerId)}`);
  }

  // -- Substation -------------------------------------------------------------

  async getSubstationList() {
    return /** @type {import("../types/api.js").SubstationData[]} */ (
      await fetchCatalogList(this.ajax, `/substation/all/page/`)
    );
  }

  /** @param {string} substationId */
  async getSubstation(substationId) {
    const list = await this.getSubstationList();
    const found = list.find((s) => String(s.id) === String(substationId));
    if (!found) {
      throw new GuildAPIError(`Substation not found: ${substationId}`, {
        status: 404,
        missing: true,
        url: `/substation/${substationId}`,
      });
    }
    return /** @type {import("../types/api.js").SubstationData} */ (found);
  }

  /** @param {string} substationId */
  async getSubstationPlayers(substationId) {
    return /** @type {import("../types/api.js").PlayerData[]} */ (
      await fetchCatalogList(this.ajax, `/player/list/substation/${encodeURIComponent(substationId)}/page/`)
    );
  }

  // -- Allocation -------------------------------------------------------------

  async getAllocationList() {
    return /** @type {import("../types/api.js").AllocationData[]} */ (
      await fetchCatalogList(this.ajax, `/allocation/all/page/`)
    );
  }

  /** @param {string} sourceId */
  async getAllocationsBySource(sourceId) {
    return /** @type {import("../types/api.js").AllocationData[]} */ (
      await fetchCatalogList(this.ajax, `/allocation/source/${encodeURIComponent(sourceId)}/page/`)
    );
  }

  // -- Infusion ---------------------------------------------------------------

  /** @param {string} playerId */
  async getInfusionByPlayer(playerId) {
    return /** @type {import("../types/api.js").InfusionData} */ (
      await this.ajax.get(`/infusion/player/${encodeURIComponent(playerId)}`)
    );
  }

  /** @param {string} reactorId */
  async getInfusionsByReactor(reactorId) {
    return /** @type {import("../types/api.js").InfusionData[]} */ (
      await fetchCatalogList(this.ajax, `/infusion/list/destination/${encodeURIComponent(reactorId)}/page/`)
    );
  }

  /** @deprecated use getInfusionsByReactor — kept for InfusionManager compat */
  async getInfusionByReactor(reactorId) {
    const rows = await this.getInfusionsByReactor(reactorId);
    return /** @type {import("../types/api.js").InfusionData | null} */ (rows[0] ?? null);
  }

  // -- Reactor ----------------------------------------------------------------

  /** @param {string} guildId */
  async getReactorList(guildId) {
    return /** @type {import("../types/api.js").ReactorData[]} */ (
      await fetchCatalogList(this.ajax, `/reactor/guild/${encodeURIComponent(guildId)}/page/`)
    );
  }

  async getNetworkReactors() {
    return /** @type {import("../types/api.js").ReactorData[]} */ (
      await fetchCatalogList(this.ajax, `/reactor/all/page/`)
    );
  }

  /** @param {string} reactorId */
  async getReactor(reactorId) {
    const network = await this.getNetworkReactors();
    const found = network.find((r) => String(r.id) === String(reactorId));
    if (!found) {
      throw new GuildAPIError(`Reactor not found: ${reactorId}`, {
        status: 404,
        missing: true,
        url: `/reactor/${reactorId}`,
      });
    }
    return /** @type {import("../types/api.js").ReactorData} */ (found);
  }

  // -- Membership applications -----------------------------------------------

  /** @param {string} guildId */
  async getMembershipApplicationsByGuild(guildId) {
    return await fetchAllCatalogPages(
      this.ajax,
      `/guild-membership-application/guild/${encodeURIComponent(guildId)}/page/`,
    );
  }

  // -- Energy market ----------------------------------------------------------

  /** @param {string} substationId */
  async getProvidersBySubstation(substationId) {
    return await fetchCatalogList(this.ajax, `/provider/substation/${encodeURIComponent(substationId)}/page/`);
  }

  async getProviderList() {
    return await fetchCatalogList(this.ajax, `/provider/all/page/`);
  }

  async getAgreementList() {
    return await fetchCatalogList(this.ajax, `/agreement/all/page/`);
  }

  /** @param {string} providerId */
  async getAgreementsByProvider(providerId) {
    return await fetchCatalogList(this.ajax, `/agreement/provider/${encodeURIComponent(providerId)}/page/`);
  }

  /**
   * Agreements for providers on the guild entry substation (Symfony has no guild_id on agreement rows).
   * @param {string} guildId
   */
  async getAgreementsByGuild(guildId) {
    const guild = await this.getGuild(guildId);
    const entrySubstationId = guild?.entry_substation_id;
    if (!entrySubstationId) return [];
    const providers = await this.getProvidersBySubstation(String(entrySubstationId));
    /** @type {unknown[]} */
    const agreements = [];
    for (const p of providers) {
      const pid = /** @type {{ id?: string }} */ (p).id;
      if (!pid) continue;
      agreements.push(...(await this.getAgreementsByProvider(String(pid))));
    }
    return agreements;
  }

  // -- Stats ------------------------------------------------------------------

  /**
   * @param {string} metric
   * @param {string} objectKey
   * @param {{ startTime?: number, endTime?: number }} [range]
   */
  async getStatRange(metric, objectKey, range = {}) {
    const start = range.startTime ?? Math.floor(Date.now() / 1000) - 86_400;
    const end = range.endTime ?? Math.floor(Date.now() / 1000);
    const qs = `?start_time=${start}&end_time=${end}`;
    const page = await fetchCatalogPage(
      this.ajax,
      `/stat/${encodeURIComponent(metric)}/object/${encodeURIComponent(objectKey)}/range/page/1${qs}`,
    );
    return page.rows;
  }

  // -- Helpers ---------------------------------------------------------------

  /**
   * Build the login message exactly as the webapp does.
   * @param {string} guildId
   * @param {string} address
   * @param {string} unixTimestamp
   */
  buildLoginMessage(guildId, address, unixTimestamp) {
    return `LOGIN_GUILD${guildId}ADDRESS${address}DATETIME${unixTimestamp}`;
  }
}
