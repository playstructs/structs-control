/**
 * Tunables for the signing queue (see src/js/store/TxQueue.js).
 *
 * Ported and adapted from references/structs-webapp/src/js/constants/
 * SigningQueueConstants.js. The game-specific charge/lane knobs are dropped --
 * the admin queue is a single ordered, block-paced lane.
 */
export const SIGNING_QUEUE = Object.freeze({
  /** sessionStorage key prefix; full key is `${PREFIX}:${wsUrl}:${address}`. */
  STORAGE_KEY_PREFIX: "signingQueue",
  /** Bump when the persisted snapshot shape changes; old snapshots are dropped. */
  STORAGE_VERSION: 1,
  /** 0 retries => exactly one broadcast attempt. Override per-enqueue. -1 == infinite. */
  DEFAULT_RETRY_LIMIT: 0,
  /** Snapshots older than this are discarded on load (stale queue protection). */
  MAX_QUEUE_AGE_MS: 30 * 60 * 1000,
  /** Rolling window used to estimate average block time for ETA math. */
  BLOCK_TIME_SAMPLE_SIZE: 20,
  /** When no GRASS block events arrive, synthesize a tick this often so the
   *  one-tx-per-block governor still releases queued txs. */
  BLOCK_FALLBACK_MS: 6000,
  /** Fallback block time when we have not yet sampled real blocks. */
  DEFAULT_BLOCK_MS: 6000,
});

/**
 * Transaction lifecycle states. Runtime object so callers can compare against
 * `TX_STATUS.CONFIRMED` instead of a magic string.
 *
 * @typedef {"pending" | "signing" | "confirming" | "confirmed" | "failed" | "cancelled"} TxStatus
 */
export const TX_STATUS = Object.freeze({
  /** Enqueued, waiting for a broadcast slot. */
  PENDING: "pending",
  /** signAndBroadcast in flight (the single in-flight slot). */
  SIGNING: "signing",
  /** Broadcast accepted; waiting for GRASS / getTx confirmation. */
  CONFIRMING: "confirming",
  /** In a block with code 0 (terminal). */
  CONFIRMED: "confirmed",
  /** Broadcast or inclusion failed, retries exhausted (terminal). */
  FAILED: "failed",
  /** Cancelled by the operator before broadcast (terminal). */
  CANCELLED: "cancelled",
});

/** Non-terminal states: counted by `pendingCount()` and persisted. */
export const ACTIVE_TX_STATUSES = Object.freeze([TX_STATUS.PENDING, TX_STATUS.SIGNING, TX_STATUS.CONFIRMING]);

/** Terminal states: resolve `whenSettled` and stay in session history. */
export const TERMINAL_TX_STATUSES = Object.freeze([TX_STATUS.CONFIRMED, TX_STATUS.FAILED, TX_STATUS.CANCELLED]);
