import { hybridConfirmStrategy } from "./confirmStrategy.js";
import { notify } from "./notify.js";

/**
 * Tx state machine + optimistic patches + the queue that powers the header
 * pending-tx badge and the Activity page.
 *
 * States:
 *   pending      enqueued, waiting to broadcast
 *   signing      signAndBroadcast in progress
 *   broadcasting same (Stargate combines sign + broadcast)
 *   confirming   broadcast returned a hash, polling for inclusion
 *   confirmed    in a block, code 0
 *   failed       broadcast or inclusion returned a non-zero code
 *
 * Optimistic patch:
 *   enqueue(msg, { optimisticPatch: (store) => () => void })
 *   The patch is applied before broadcast; the returned function is called to
 *   roll back on failure.
 *
 * The actual signing primitive (SigningStargateClient) is injected via
 * `attachStargate(signingClient, address)` so this module stays decoupled from
 * @cosmjs and works in tests.
 */

/** @typedef {"pending" | "signing" | "broadcasting" | "confirming" | "confirmed" | "failed"} TxStatus */

/**
 * @typedef {{
 *   id: string,
 *   typeUrl: string,
 *   msg: { typeUrl: string, value: unknown },
 *   memo: string,
 *   status: TxStatus,
 *   hash?: string,
 *   height?: number,
 *   error?: string,
 *   createdAt: number,
 *   updatedAt: number,
 *   rollback?: () => void,
 * }} TxRecord
 */

let seq = 0;
const nextId = () => `tx_${Date.now().toString(36)}_${(++seq).toString(36)}`;

export class TxQueue {
  /**
   * @param {import("./Store.js").Store} store
   * @param {{ confirmStrategy?: import("./confirmStrategy.js").ConfirmStrategy }} [options]
   */
  constructor(store, options = {}) {
    this.store = store;
    store.tx = this;
    /** @type {TxRecord[]} */
    this._records = [];
    /** @type {Set<() => void>} */
    this._subscribers = new Set();
    this.confirmStrategy = options.confirmStrategy ?? hybridConfirmStrategy;
    /** @type {{ signingClient: unknown, address: string } | null} */
    this._stargate = null;
    /** @type {{ amount: Array<{ denom: string, amount: string }>, gas: string }} */
    this._defaultFee = { amount: [], gas: "200000" };
  }

  /**
   * @param {unknown} signingClient SigningStargateClient
   * @param {string} address signing address
   * @param {{ amount: Array<{ denom: string, amount: string }>, gas: string }} [fee]
   */
  attachStargate(signingClient, address, fee) {
    this._stargate = { signingClient, address };
    if (fee) this._defaultFee = fee;
  }

  detachStargate() {
    this._stargate = null;
  }

  /** @returns {TxRecord[]} */
  list() {
    return this._records.slice();
  }

  /** @returns {number} count of in-flight (non-terminal) txs */
  pendingCount() {
    return this._records.filter(
      (r) => r.status === "pending" || r.status === "signing" || r.status === "broadcasting" || r.status === "confirming",
    ).length;
  }

  /**
   * @param {() => void} subscriber
   * @returns {() => void}
   */
  subscribe(subscriber) {
    this._subscribers.add(subscriber);
    return () => this._subscribers.delete(subscriber);
  }

  _notify() {
    for (const s of this._subscribers) s();
  }

  /**
   * Enqueue a chain message for signing + broadcast. Resolves when the tx
   * reaches a terminal state (confirmed or failed). The returned record is
   * always the same reference held in `this._records` so callers can poll it.
   *
   * @param {{ typeUrl: string, value: unknown }} msg
   * @param {{
   *   memo?: string,
   *   optimisticPatch?: (store: import("./Store.js").Store) => (() => void),
   *   invalidate?: ReadonlyArray<ReadonlyArray<string | number>>,
   * }} [options]
   * @returns {Promise<TxRecord>}
   */
  async enqueue(msg, options = {}) {
    /** @type {TxRecord} */
    const record = {
      id: nextId(),
      typeUrl: msg.typeUrl,
      msg,
      memo: options.memo ?? "",
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this._records.unshift(record);
    this._notify();

    if (options.optimisticPatch) {
      try {
        record.rollback = options.optimisticPatch(this.store);
      } catch (e) {
        console.warn("[TxQueue] optimisticPatch threw, ignoring:", e);
      }
    }

    if (!this._stargate) {
      this._transition(record, "failed", { error: "Signing client not initialised. Are you logged in?" });
      record.rollback?.();
      return record;
    }

    this._transition(record, "signing");

    try {
      // SigningStargateClient.signAndBroadcast(signerAddress, messages, fee, memo)
      const { signingClient, address } = this._stargate;
      const stargate = /** @type {{ signAndBroadcast: (a: string, m: unknown[], f: unknown, memo: string) => Promise<{ code: number, transactionHash: string, height?: number }> }} */ (signingClient);
      const response = await stargate.signAndBroadcast(address, [msg], this._defaultFee, record.memo);
      record.hash = response.transactionHash;
      if (response.code !== 0) {
        this._transition(record, "failed", { error: `Broadcast failed with code ${response.code}` });
        record.rollback?.();
        return record;
      }
      this._transition(record, "confirming", { hash: response.transactionHash, height: response.height });

      const result = await this.confirmStrategy(signingClient, response.transactionHash);
      if (result.status === "confirmed") {
        this._transition(record, "confirmed", { height: result.height });
        // invalidate listed cache keys so consumers refetch
        for (const key of options.invalidate ?? []) {
          this.store.invalidate(key);
        }
      } else {
        this._transition(record, "failed", { error: result.error.message });
        record.rollback?.();
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      this._transition(record, "failed", { error: err.message });
      record.rollback?.();
      notify.fromError(err);
    }

    return record;
  }

  /**
   * @param {TxRecord} record
   * @param {TxStatus} status
   * @param {Partial<TxRecord>} [patch]
   */
  _transition(record, status, patch = {}) {
    record.status = status;
    record.updatedAt = Date.now();
    Object.assign(record, patch);
    this._notify();
  }

  clear() {
    this._records.length = 0;
    this._notify();
  }
}
