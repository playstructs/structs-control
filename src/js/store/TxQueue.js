import { hybridConfirmStrategy } from "./confirmStrategy.js";
import { notify } from "./notify.js";
import { EVENTS } from "../constants/Events.js";
import {
  SIGNING_QUEUE,
  TX_STATUS,
  ACTIVE_TX_STATUSES,
  TERMINAL_TX_STATUSES,
} from "../constants/SigningQueueConstants.js";

/**
 * Serialized, block-paced signing queue.
 *
 * This is the single authority for *how transactions are issued, monitored,
 * and acted upon*. See docs/TRANSACTIONS.md for the developer/UI guide.
 *
 * Design (ported from structs-webapp's SigningQueueManager, minus the
 * game-specific charge/action lanes):
 *
 *   - One ordered lane. At most ONE tx is signing at a time (`_inFlight`), so
 *     the account sequence can never race. Each `signAndBroadcast` resolves
 *     (the tx is already in a block) before the next one is signed.
 *   - Block-paced: a new broadcast is released on each `BLOCK_HEIGHT_CHANGED`
 *     (one tx per block). A timer fallback synthesizes ticks when GRASS is not
 *     connected so the queue still drains.
 *   - Persistence: the actionable queue is mirrored to sessionStorage per
 *     `wsUrl:address` so a reload does not lose queued work. Records that were
 *     mid-broadcast at reload are marked failed (never silently re-broadcast).
 *   - Settlement: `enqueue()` / `whenSettled(id)` resolve when a tx reaches a
 *     terminal state; `TX_*` window events fire for event-driven consumers.
 *
 * State machine:
 *   pending -> signing -> confirming -> confirmed        (success)
 *                      \-> (retry) -> pending             (broadcast failure, retries left)
 *                      \-> failed                         (broadcast failure, no retries)
 *   pending -> cancelled                                  (operator cancels)
 *
 * Kept from this repo (the webapp has neither):
 *   - `optimisticPatch` (applied on enqueue, rolled back on terminal failure)
 *   - `invalidate` cache keys (applied on confirm)
 *   - `hybridConfirmStrategy` (GRASS wait -> getTx backoff)
 */

/** @typedef {import("../constants/SigningQueueConstants.js").TxStatus} TxStatus */

/**
 * @typedef {{
 *   id: string,
 *   typeUrl: string,
 *   msg: { typeUrl: string, value: any },
 *   memo: string,
 *   status: TxStatus,
 *   attempts: number,
 *   retryLimit: number,
 *   invalidate: ReadonlyArray<ReadonlyArray<string | number>>,
 *   hash?: string,
 *   height?: number,
 *   error?: string,
 *   createdAt: number,
 *   updatedAt: number,
 *   rollback?: () => void,
 *   _patch?: (store: import("./Store.js").Store) => (() => void),
 * }} TxRecord
 */

/** @type {Set<string>} */
const ACTIVE = new Set(ACTIVE_TX_STATUSES);
/** @type {Set<string>} */
const TERMINAL = new Set(TERMINAL_TX_STATUSES);

let seq = 0;
const nextId = () => `tx_${Date.now().toString(36)}_${(++seq).toString(36)}`;

/**
 * Throws if `value` cannot be safely JSON-persisted (e.g. contains bigint,
 * functions, or circular refs). Guards the persistence layer so a queued tx is
 * always rehydratable.
 * @param {unknown} value
 */
export function assertSerializable(value) {
  JSON.stringify(value, (_key, v) => {
    if (typeof v === "bigint") throw new Error("bigint values cannot be queued");
    if (typeof v === "function") throw new Error("function values cannot be queued");
    return v;
  });
}

export class TxQueue {
  /**
   * @param {import("./Store.js").Store} store
   * @param {{
   *   confirmStrategy?: import("./confirmStrategy.js").ConfirmStrategy,
   *   blockPacing?: boolean,
   *   retryBackoffMs?: number,
   * }} [options]
   */
  constructor(store, options = {}) {
    this.store = store;
    store.tx = this;

    /** delay before re-attempting a failed broadcast; defaults to avg block time */
    this._retryBackoffMs = options.retryBackoffMs;

    /** @type {TxRecord[]} kept in enqueue order; pending order == broadcast order */
    this._records = [];
    /** @type {Set<() => void>} */
    this._subscribers = new Set();
    /** @type {Map<string, Array<(record: TxRecord) => void>>} */
    this._waiters = new Map();

    this.confirmStrategy = options.confirmStrategy ?? hybridConfirmStrategy;

    /** @type {{ signingClient: any, address: string } | null} */
    this._stargate = null;
    /** @type {{ amount: Array<{ denom: string, amount: string }>, gas: string }} */
    this._defaultFee = { amount: [], gas: "200000" };
    this._wsUrl = "";
    this._address = "";

    // -- block pacing --
    /** the record currently being signed (max 1) */
    this._inFlight = /** @type {TxRecord | null} */ (null);
    this._currentHeight = 0;
    this._lastBroadcastHeight = -1;
    this._blockDriven = false;
    this._lastBlockEventAt = 0;
    /** @type {number[]} recent block timestamps for ETA math */
    this._blockTimes = [];

    this._blockPacing = options.blockPacing !== false;
    /** @type {ReturnType<typeof setInterval> | null} */
    this._fallbackTimer = null;
    this._onBlock = /** @param {Event} e */ (e) => {
      const detail = /** @type {CustomEvent} */ (e).detail;
      this._handleBlock(Number(detail?.height ?? 0));
    };

    if (this._blockPacing && typeof window !== "undefined") {
      window.addEventListener(EVENTS.BLOCK_HEIGHT_CHANGED, this._onBlock);
      this._fallbackTimer = setInterval(() => this._fallbackTick(), SIGNING_QUEUE.BLOCK_FALLBACK_MS);
    }
  }

  // ---------------------------------------------------------------------------
  // Signing client lifecycle
  // ---------------------------------------------------------------------------

  /**
   * @param {any} signingClient SigningStargateClient
   * @param {string} address signing address
   * @param {{ amount: Array<{ denom: string, amount: string }>, gas: string }} [fee]
   * @param {string} [wsUrl] chain WS URL (used to scope persistence per chain)
   */
  attachStargate(signingClient, address, fee, wsUrl) {
    this._stargate = { signingClient, address };
    this._address = address;
    if (fee) this._defaultFee = fee;
    if (wsUrl) this._wsUrl = wsUrl;
    this._loadPersisted();
    this._pump();
  }

  detachStargate() {
    this._stargate = null;
    this._inFlight = null;
  }

  // ---------------------------------------------------------------------------
  // Reads (consumed by HeaderViewModel, OverviewController, ActivityController)
  // ---------------------------------------------------------------------------

  /** @returns {TxRecord[]} a copy of all records (queue + history) */
  list() {
    return this._records.slice();
  }

  /** @returns {TxRecord[]} pending records in broadcast order */
  queue() {
    return this._records.filter((r) => r.status === TX_STATUS.PENDING);
  }

  /** @returns {number} count of in-flight (non-terminal) txs */
  pendingCount() {
    return this._records.filter((r) => ACTIVE.has(r.status)).length;
  }

  /**
   * @param {string} id
   * @returns {TxRecord | null}
   */
  getTransaction(id) {
    return this._records.find((r) => r.id === id) ?? null;
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

  // ---------------------------------------------------------------------------
  // Issue
  // ---------------------------------------------------------------------------

  /**
   * Enqueue a chain message for signing + broadcast. Returns a promise that
   * resolves (never rejects) with the final record when it reaches a terminal
   * state. The returned record is the same reference held in the queue, so
   * callers may also poll `record.status`.
   *
   * @param {{ typeUrl: string, value: any }} msg
   * @param {{
   *   memo?: string,
   *   optimisticPatch?: (store: import("./Store.js").Store) => (() => void),
   *   invalidate?: ReadonlyArray<ReadonlyArray<string | number>>,
   *   retryLimit?: number,
   * }} [options]
   * @returns {Promise<TxRecord>}
   */
  enqueue(msg, options = {}) {
    /** @type {TxRecord} */
    const record = {
      id: nextId(),
      typeUrl: msg.typeUrl,
      msg,
      memo: options.memo ?? "",
      status: TX_STATUS.PENDING,
      attempts: 0,
      retryLimit: options.retryLimit ?? SIGNING_QUEUE.DEFAULT_RETRY_LIMIT,
      invalidate: (options.invalidate ?? []).map((k) => [...k]),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      assertSerializable(msg.value);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      record.status = TX_STATUS.FAILED;
      record.error = `Message is not serializable: ${err.message}`;
      this._records.push(record);
      this._notify();
      this._dispatch(EVENTS.TX_FAILED, record);
      return Promise.resolve(record);
    }

    this._records.push(record);

    if (options.optimisticPatch) {
      record._patch = options.optimisticPatch;
      try {
        record.rollback = options.optimisticPatch(this.store);
      } catch (e) {
        console.warn("[TxQueue] optimisticPatch threw, ignoring:", e);
      }
    }

    this._notify();
    this._persist();
    this._dispatch(EVENTS.TX_ENQUEUED, record);

    const settled = this.whenSettled(record.id);
    this._pump();
    return settled;
  }

  /**
   * Resolve when the given tx settles (confirmed / failed / cancelled). Resolves
   * immediately if already terminal, and resolves with a synthetic failed record
   * for an unknown / evicted id (never hangs).
   *
   * @param {string} id
   * @returns {Promise<TxRecord>}
   */
  whenSettled(id) {
    const rec = this._records.find((r) => r.id === id);
    if (!rec) {
      return Promise.resolve(/** @type {TxRecord} */ ({ id, status: TX_STATUS.FAILED, error: "unknown transaction" }));
    }
    if (TERMINAL.has(rec.status)) return Promise.resolve(rec);
    return new Promise((resolve) => {
      const arr = this._waiters.get(id) ?? [];
      arr.push(resolve);
      this._waiters.set(id, arr);
    });
  }

  // ---------------------------------------------------------------------------
  // Act on queued transactions
  // ---------------------------------------------------------------------------

  /**
   * Cancel a transaction that has not started broadcasting.
   * @param {string} id
   * @returns {boolean} true if cancelled
   */
  cancel(id) {
    const rec = this._records.find((r) => r.id === id);
    if (!rec || rec.status !== TX_STATUS.PENDING) return false;
    this._transition(rec, TX_STATUS.CANCELLED);
    rec.rollback?.();
    rec.rollback = undefined;
    this._settle(rec);
    return true;
  }

  /**
   * Re-queue a failed transaction for another attempt.
   * @param {string} id
   * @returns {boolean} true if re-queued
   */
  retry(id) {
    const rec = this._records.find((r) => r.id === id);
    if (!rec || rec.status !== TX_STATUS.FAILED) return false;
    rec.attempts = 0;
    rec.error = undefined;
    rec.hash = undefined;
    rec.height = undefined;
    if (rec._patch) {
      try {
        rec.rollback = rec._patch(this.store);
      } catch (e) {
        console.warn("[TxQueue] optimisticPatch threw on retry, ignoring:", e);
      }
    }
    this._transition(rec, TX_STATUS.PENDING);
    this._pump();
    return true;
  }

  /**
   * Move a pending transaction to a new position within the pending queue.
   * @param {string} id
   * @param {number} newIndex zero-based index among pending records
   * @returns {boolean}
   */
  reorder(id, newIndex) {
    const rec = this._records.find((r) => r.id === id);
    if (!rec || rec.status !== TX_STATUS.PENDING) return false;
    const pending = this._records.filter((r) => r.status === TX_STATUS.PENDING);
    const cur = pending.indexOf(rec);
    const clamped = Math.max(0, Math.min(newIndex, pending.length - 1));
    if (cur === clamped) return true;
    pending.splice(cur, 1);
    pending.splice(clamped, 0, rec);
    let pi = 0;
    this._records = this._records.map((r) => (r.status === TX_STATUS.PENDING ? pending[pi++] : r));
    this._persist();
    this._notify();
    return true;
  }

  /** @param {string} id @returns {boolean} */
  moveUp(id) {
    const pending = this.queue();
    const i = pending.findIndex((r) => r.id === id);
    if (i <= 0) return false;
    return this.reorder(id, i - 1);
  }

  /** @param {string} id @returns {boolean} */
  moveDown(id) {
    const pending = this.queue();
    const i = pending.findIndex((r) => r.id === id);
    if (i < 0 || i >= pending.length - 1) return false;
    return this.reorder(id, i + 1);
  }

  // ---------------------------------------------------------------------------
  // Timelines
  // ---------------------------------------------------------------------------

  /** @returns {number} rolling average block time in ms (or a sane default) */
  getAvgBlockMs() {
    if (this._blockTimes.length < 2) return SIGNING_QUEUE.DEFAULT_BLOCK_MS;
    let sum = 0;
    for (let i = 1; i < this._blockTimes.length; i++) sum += this._blockTimes[i] - this._blockTimes[i - 1];
    const avg = sum / (this._blockTimes.length - 1);
    return avg > 0 ? avg : SIGNING_QUEUE.DEFAULT_BLOCK_MS;
  }

  /**
   * Estimate how long until a queued tx broadcasts. Pacing is one tx per block.
   * @param {string} id
   * @returns {{ position: number, blocksRemaining: number, etaMs: number } | null}
   */
  estimateWait(id) {
    const rec = this._records.find((r) => r.id === id);
    if (!rec) return null;
    if (rec.status === TX_STATUS.SIGNING || rec.status === TX_STATUS.CONFIRMING) {
      return { position: 0, blocksRemaining: 0, etaMs: 0 };
    }
    if (rec.status !== TX_STATUS.PENDING) return null;
    const pending = this.queue();
    const idx = pending.indexOf(rec);
    const ahead = idx + (this._inFlight ? 1 : 0);
    const blocksRemaining = ahead + 1;
    return { position: idx + 1, blocksRemaining, etaMs: blocksRemaining * this.getAvgBlockMs() };
  }

  // ---------------------------------------------------------------------------
  // Block-paced broadcast loop
  // ---------------------------------------------------------------------------

  /** @param {number} height */
  _handleBlock(height) {
    if (height > this._currentHeight) this._currentHeight = height;
    this._blockDriven = true;
    this._lastBlockEventAt = Date.now();
    this._recordBlockTime();
    this._pump();
  }

  _fallbackTick() {
    // Only synthesize a tick when real block events are not arriving.
    if (Date.now() - this._lastBlockEventAt >= SIGNING_QUEUE.BLOCK_FALLBACK_MS) {
      this._currentHeight += 1;
      this._pump();
    }
  }

  _recordBlockTime() {
    this._blockTimes.push(Date.now());
    if (this._blockTimes.length > SIGNING_QUEUE.BLOCK_TIME_SAMPLE_SIZE) this._blockTimes.shift();
  }

  /** Try to broadcast the head of the queue if a slot is available. */
  _pump() {
    if (this._inFlight) return;
    if (!this._stargate) return;
    const head = this._records.find((r) => r.status === TX_STATUS.PENDING);
    if (!head) return;
    // One tx per block once we are receiving real block events.
    if (this._blockDriven && this._lastBroadcastHeight >= this._currentHeight) return;
    void this._broadcast(head);
  }

  /** @param {TxRecord} record */
  async _broadcast(record) {
    const stargate = this._stargate;
    if (!stargate) return;

    // Wrong-signer guard: a rehydrated record from a different account must not
    // be signed by the current wallet.
    const creator = record.msg?.value?.creator;
    if (creator && creator !== stargate.address) {
      this._fail(record, new Error("Queued transaction belongs to a different signer"), true);
      this._pump();
      return;
    }

    this._inFlight = record;
    this._lastBroadcastHeight = this._currentHeight;
    record.attempts += 1;
    this._transition(record, TX_STATUS.SIGNING);
    this._dispatch(EVENTS.TX_BROADCAST, record);

    let response;
    try {
      response = await stargate.signingClient.signAndBroadcast(
        stargate.address,
        [record.msg],
        this._defaultFee,
        record.memo,
      );
    } catch (e) {
      this._inFlight = null;
      const err = e instanceof Error ? e : new Error(String(e));
      const txId = /** @type {any} */ (err).txId;
      if (txId) {
        // The tx reached the network (cosmjs TimeoutError) -- never resubmit.
        record.hash = txId;
        this._transition(record, TX_STATUS.CONFIRMING, { hash: txId });
        this._pump();
        void this._confirm(record, stargate.signingClient, false);
        return;
      }
      this._handleBroadcastFailure(record, err);
      this._pump();
      return;
    }

    record.hash = response.transactionHash;
    if (response.code !== 0) {
      this._inFlight = null;
      this._handleBroadcastFailure(record, new Error(`Broadcast failed with code ${response.code}`));
      this._pump();
      return;
    }

    // Broadcast succeeded (cosmjs resolves only after on-chain inclusion).
    this._transition(record, TX_STATUS.CONFIRMING, {
      hash: response.transactionHash,
      height: response.height,
    });
    this._inFlight = null;
    this._pump();
    void this._confirm(record, stargate.signingClient, true);
  }

  /**
   * @param {TxRecord} record
   * @param {any} signingClient
   * @param {boolean} broadcastConfirmed true when signAndBroadcast already
   *   reported inclusion (code 0); the confirm step is then best-effort timing
   *   for cache invalidation and must never downgrade the tx to failed.
   */
  async _confirm(record, signingClient, broadcastConfirmed) {
    let result = null;
    try {
      result = await this.confirmStrategy(signingClient, /** @type {string} */ (record.hash));
    } catch (e) {
      void e;
    }

    if (result && result.status === "confirmed") {
      this._finalizeSuccess(record, result.height);
      return;
    }

    if (broadcastConfirmed) {
      // Inclusion is already proven by the broadcast result; align cache now.
      this._finalizeSuccess(record, record.height);
      return;
    }

    // Came from a broadcast TimeoutError; we never resubmit (avoid double-send).
    if (result && result.status === "failed") {
      this._fail(record, result.error ?? new Error("Transaction failed on chain"), true);
      return;
    }
    this._fail(record, new Error("Transaction not confirmed; verify on chain before retrying"), false);
  }

  /** @param {TxRecord} record @param {number | undefined} height */
  _finalizeSuccess(record, height) {
    if (record.status === TX_STATUS.CONFIRMED) return;
    this._transition(record, TX_STATUS.CONFIRMED, { height });
    for (const key of record.invalidate ?? []) this.store.invalidate(key);
    record.rollback = undefined;
    this._settle(record);
  }

  /** @param {TxRecord} record @param {Error} err */
  _handleBroadcastFailure(record, err) {
    const canRetry = record.retryLimit === -1 || record.attempts <= record.retryLimit;
    if (canRetry) {
      this._transition(record, TX_STATUS.PENDING, { error: err.message });
      // Space retries out so we do not hot-loop on a persistent failure.
      const delay = this._retryBackoffMs ?? this.getAvgBlockMs();
      setTimeout(() => this._pump(), delay);
    } else {
      this._fail(record, err, true);
    }
  }

  /**
   * @param {TxRecord} record
   * @param {Error} err
   * @param {boolean} doRollback roll the optimistic patch back (skip when the
   *   on-chain outcome is uncertain, so the optimistic UI is not reverted on a
   *   tx that may have actually landed).
   */
  _fail(record, err, doRollback) {
    this._transition(record, TX_STATUS.FAILED, { error: err.message });
    if (doRollback) record.rollback?.();
    record.rollback = undefined;
    this._settle(record);
    notify.fromError(err);
  }

  // ---------------------------------------------------------------------------
  // State transitions + settlement
  // ---------------------------------------------------------------------------

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
    this._persist();
  }

  /** @param {TxRecord} record */
  _settle(record) {
    const arr = this._waiters.get(record.id);
    if (arr) {
      this._waiters.delete(record.id);
      for (const resolve of arr) resolve(record);
    }
    if (record.status === TX_STATUS.CONFIRMED) this._dispatch(EVENTS.TX_CONFIRMED, record);
    else this._dispatch(EVENTS.TX_FAILED, record);
  }

  /** @param {string} name @param {TxRecord} record */
  _dispatch(name, record) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(name, {
        detail: {
          id: record.id,
          status: record.status,
          typeUrl: record.typeUrl,
          hash: record.hash,
          height: record.height,
          error: record.error,
        },
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Persistence (sessionStorage, per wsUrl:address)
  // ---------------------------------------------------------------------------

  /** @returns {string | null} */
  _storageKey() {
    if (!this._address) return null;
    return `${SIGNING_QUEUE.STORAGE_KEY_PREFIX}:${this._wsUrl}:${this._address}`;
  }

  _persist() {
    const key = this._storageKey();
    if (key === null || typeof sessionStorage === "undefined") return;
    try {
      const actionable = this._records.filter((r) => ACTIVE.has(r.status));
      const snapshot = {
        version: SIGNING_QUEUE.STORAGE_VERSION,
        savedAt: Date.now(),
        records: actionable.map((r) => ({
          id: r.id,
          typeUrl: r.typeUrl,
          msg: r.msg,
          memo: r.memo,
          status: r.status,
          attempts: r.attempts,
          retryLimit: r.retryLimit,
          invalidate: r.invalidate,
          hash: r.hash,
          height: r.height,
          error: r.error,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      };
      sessionStorage.setItem(key, JSON.stringify(snapshot));
    } catch (e) {
      console.warn("[TxQueue] persist failed:", e);
    }
  }

  _loadPersisted() {
    const key = this._storageKey();
    if (key === null || typeof sessionStorage === "undefined") return;
    let raw;
    try {
      raw = sessionStorage.getItem(key);
    } catch {
      return;
    }
    if (!raw) return;

    let snap;
    try {
      snap = JSON.parse(raw);
    } catch {
      this._quarantine(key, raw);
      return;
    }
    if (!snap || snap.version !== SIGNING_QUEUE.STORAGE_VERSION) {
      this._removeKey(key);
      return;
    }
    if (Date.now() - (snap.savedAt ?? 0) > SIGNING_QUEUE.MAX_QUEUE_AGE_MS) {
      this._removeKey(key);
      return;
    }

    /** @type {TxRecord[]} */
    const restored = [];
    for (const r of snap.records ?? []) {
      if (!r || typeof r.typeUrl !== "string" || !r.msg) continue;
      let status = r.status;
      let error = r.error;
      // Conservative: a tx that had already started broadcasting may have landed
      // on chain. Never silently re-broadcast it -- surface it as failed so the
      // operator can verify and retry deliberately.
      if (status === TX_STATUS.SIGNING || status === TX_STATUS.CONFIRMING) {
        status = TX_STATUS.FAILED;
        error = "Interrupted by reload; verify on chain before retrying";
      }
      restored.push({
        id: typeof r.id === "string" ? r.id : nextId(),
        typeUrl: r.typeUrl,
        msg: r.msg,
        memo: r.memo ?? "",
        status,
        attempts: r.attempts ?? 0,
        retryLimit: r.retryLimit ?? SIGNING_QUEUE.DEFAULT_RETRY_LIMIT,
        invalidate: r.invalidate ?? [],
        hash: r.hash,
        height: r.height,
        error,
        createdAt: r.createdAt ?? Date.now(),
        updatedAt: r.updatedAt ?? Date.now(),
      });
    }
    if (!restored.length) return;

    const existing = new Set(this._records.map((r) => r.id));
    const fresh = restored.filter((r) => !existing.has(r.id));
    if (!fresh.length) return;
    this._records = fresh.concat(this._records);
    this._notify();
    this._persist();
    this._pump();
  }

  /** @param {string} key */
  _removeKey(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      void e;
    }
  }

  /** @param {string} key @param {string} raw */
  _quarantine(key, raw) {
    try {
      sessionStorage.setItem(`${key}.corrupt`, raw);
    } catch (e) {
      void e;
    }
    this._removeKey(key);
  }

  // ---------------------------------------------------------------------------
  // Teardown
  // ---------------------------------------------------------------------------

  /** Drop all records + persisted snapshot. Used on logout. */
  clear() {
    this._records.length = 0;
    this._inFlight = null;
    this._waiters.clear();
    const key = this._storageKey();
    if (key !== null) this._removeKey(key);
    this._notify();
  }

  /** Remove window/timer listeners. */
  destroy() {
    if (this._fallbackTimer) clearInterval(this._fallbackTimer);
    if (typeof window !== "undefined") window.removeEventListener(EVENTS.BLOCK_HEIGHT_CHANGED, this._onBlock);
  }
}
