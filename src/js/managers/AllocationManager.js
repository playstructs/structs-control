import { keys } from "../store/keys.js";
import {
  buildAllocationCreate,
  buildAllocationDelete,
  buildAllocationUpdate,
} from "../util/txMessages.js";

export class AllocationManager {
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

  _defaultController() {
    return this.store.session?.data?.playerId ?? "";
  }

  fetchList() {
    return this.store.query(keys.allocationList(), () => this.guildAPI.getAllocationList());
  }

  /** @param {string} sourceId */
  fetchBySource(sourceId) {
    return this.store.query(keys.allocationBySource(sourceId), () => this.guildAPI.getAllocationsBySource(sourceId));
  }

  /**
   * @param {{ controller?: string, sourceObjectId: string, allocationType: string, power: string | number }} body
   */
  buildCreate(body) {
    return buildAllocationCreate({
      creator: this._creator(),
      controller: body.controller || this._defaultController(),
      sourceObjectId: body.sourceObjectId,
      allocationType: body.allocationType,
      power: body.power,
    });
  }

  /** @param {{ allocationId: string, power: string | number }} body */
  buildUpdate(body) {
    return buildAllocationUpdate({
      creator: this._creator(),
      allocationId: body.allocationId,
      power: body.power,
    });
  }

  /** @param {{ allocationId: string }} body */
  buildDelete(body) {
    return buildAllocationDelete({
      creator: this._creator(),
      allocationId: body.allocationId,
    });
  }

  /**
   * @param {{ controller?: string, sourceObjectId: string, allocationType: string, power: string | number }} body
   */
  async enqueueCreate(body) {
    const invalidate = [keys.allocationList(), keys.allocationBySource(body.sourceObjectId)];
    await this.store.tx?.enqueue(this.buildCreate(body), { invalidate });
  }

  /**
   * @param {{ allocationId: string, sourceId?: string, power: string | number }} body
   */
  async enqueueUpdate(body) {
    /** @type {import("../store/keys.js").CacheKey[]} */
    const invalidate = [keys.allocationList(), keys.allocation(body.allocationId)];
    if (body.sourceId) invalidate.push(keys.allocationBySource(body.sourceId));
    await this.store.tx?.enqueue(this.buildUpdate(body), { invalidate });
  }

  /**
   * @param {{ allocationId: string, sourceId?: string }} body
   */
  async enqueueDelete(body) {
    /** @type {import("../store/keys.js").CacheKey[]} */
    const invalidate = [keys.allocationList(), keys.allocation(body.allocationId)];
    if (body.sourceId) invalidate.push(keys.allocationBySource(body.sourceId));
    await this.store.tx?.enqueue(this.buildDelete(body), { invalidate });
  }
}
