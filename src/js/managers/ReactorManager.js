import { keys } from "../store/keys.js";
import { buildReactorDefuse, buildReactorInfuse } from "../util/txMessages.js";

export class ReactorManager {
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

  _delegatorAddress() {
    return this.store.session?.data?.address ?? "";
  }

  /** @param {string} guildId */
  fetchList(guildId) {
    return this.store.query(keys.reactorList(guildId), () => this.guildAPI.getReactorList(guildId));
  }

  fetchNetwork() {
    return this.store.query(keys.reactorNetwork(), () => this.guildAPI.getNetworkReactors());
  }

  /** @param {string} reactorId */
  fetchReactor(reactorId) {
    return this.store.query(keys.reactor(reactorId), () => this.guildAPI.getReactor(reactorId));
  }

  /**
   * @param {{ validatorAddress: string, amountAlpha: string | number, delegatorAddress?: string, reactorId?: string }} body
   */
  buildInfuse(body) {
    return buildReactorInfuse({
      creator: this._creator(),
      delegatorAddress: body.delegatorAddress ?? this._delegatorAddress(),
      validatorAddress: body.validatorAddress,
      amountAlpha: body.amountAlpha,
    });
  }

  /**
   * @param {{ validatorAddress: string, amountAlpha: string | number, delegatorAddress?: string, reactorId?: string }} body
   */
  buildDefuse(body) {
    return buildReactorDefuse({
      creator: this._creator(),
      delegatorAddress: body.delegatorAddress ?? this._delegatorAddress(),
      validatorAddress: body.validatorAddress,
      amountAlpha: body.amountAlpha,
    });
  }

  /**
   * @param {{ validatorAddress: string, amountAlpha: string | number, reactorId?: string }} body
   */
  async enqueueInfuse(body) {
    /** @type {import("../store/keys.js").CacheKey[]} */
    const invalidate = [];
    if (body.reactorId) {
      invalidate.push(keys.reactor(body.reactorId), keys.reactorInfusion(body.reactorId));
    }
    await this.store.tx?.enqueue(this.buildInfuse(body), { invalidate });
  }

  /**
   * @param {{ validatorAddress: string, amountAlpha: string | number, reactorId?: string }} body
   */
  async enqueueDefuse(body) {
    /** @type {import("../store/keys.js").CacheKey[]} */
    const invalidate = [];
    if (body.reactorId) {
      invalidate.push(keys.reactor(body.reactorId), keys.reactorInfusion(body.reactorId));
    }
    await this.store.tx?.enqueue(this.buildDefuse(body), { invalidate });
  }
}
