import {
  buildGuildBankMint,
  buildGuildBankRedeem,
  buildGuildBankConfiscateAndBurn,
} from "../util/txMessages.js";

/**
 * Builds bank mint/redeem/confiscate-and-burn transactions. The actual signing
 * happens via store.tx.enqueue(); this class just shapes the payload.
 */
export class BankManager {
  /**
   * @param {{ store: import("../store/Store.js").Store }} deps
   */
  constructor(deps) {
    this.store = deps.store;
  }

  _creator() {
    return this.store.session?.data?.address ?? "";
  }

  /**
   * @param {{ amountAlpha: string | number, amountToken: string | number }} body
   */
  buildMint(body) {
    return buildGuildBankMint({
      creator: this._creator(),
      amountAlpha: body.amountAlpha,
      amountToken: body.amountToken,
    });
  }

  /**
   * @param {{ amount: string, denom: string }} body
   */
  buildRedeem(body) {
    return buildGuildBankRedeem({
      creator: this._creator(),
      amount: body.amount,
      denom: body.denom,
    });
  }

  /**
   * @param {{ fromAddress: string, amountToken: string | number }} body
   */
  buildConfiscateAndBurn(body) {
    return buildGuildBankConfiscateAndBurn({
      creator: this._creator(),
      fromAddress: body.fromAddress,
      amountToken: body.amountToken,
    });
  }
}
