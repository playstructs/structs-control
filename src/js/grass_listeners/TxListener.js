import { AbstractGrassListener } from "../framework/AbstractGrassListener.js";
import { EVENTS } from "../constants/Events.js";
import { notifyGrassTxConfirmed } from "../store/confirmStrategy.js";

/**
 * Listens for transaction confirmations from the chain. Feeds TxQueue via
 * hybridConfirmStrategy and dispatches TX_CONFIRMED for other consumers.
 */
export class TxListener extends AbstractGrassListener {
  constructor() {
    super("TxListener");
  }

  handler(data) {
    if (data?.category !== "tx" && !data?.hash) return;
    const detail = { hash: data.hash, height: data.height, code: data.code };
    notifyGrassTxConfirmed(detail);
    window.dispatchEvent(new CustomEvent(EVENTS.TX_CONFIRMED, { detail }));
  }
}
