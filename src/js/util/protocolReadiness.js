/**
 * Guild API envelope `meta` protocol readiness (v0.22+).
 *
 * When `meta` is absent, treat as unknown and allow — older Guild deployments
 * may not emit readiness fields yet. Explicit `transaction_ready: false` blocks.
 */

/**
 * @param {Record<string, unknown> | null | undefined} meta
 * @returns {boolean}
 */
export function isDataReady(meta) {
  if (!meta || typeof meta !== "object") return true;
  if (meta.data_ready === false) return false;
  return true;
}

/**
 * @param {Record<string, unknown> | null | undefined} meta
 * @returns {boolean}
 */
export function isTransactionReady(meta) {
  if (!meta || typeof meta !== "object") return true;
  if (meta.transaction_ready === false) return false;
  return true;
}

/**
 * @param {Record<string, unknown> | null | undefined} meta
 * @returns {string}
 */
export function transactionNotReadyMessage(meta) {
  const protocol = meta?.protocol != null ? String(meta.protocol) : "unknown";
  const height = meta?.indexed_height ?? meta?.height ?? "?";
  const reason =
    typeof meta?.reason === "string" && meta.reason
      ? meta.reason
      : "Guild API reports transaction_ready=false";
  return `${reason} (protocol ${protocol}, indexed height ${height})`;
}
