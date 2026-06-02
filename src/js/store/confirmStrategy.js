/**
 * Pluggable tx-confirmation strategy.
 *
 * v1: hybrid GRASS + polling. TxListener calls `notifyGrassTxConfirmed` when
 * a `structs.tx.*` message arrives; we wait briefly for that before falling
 * back to Stargate `getTx` polling.
 */

/**
 * @typedef {{ status: "confirmed", height: number, txResult: unknown }
 *          | { status: "failed",    error: Error }
 *          | { status: "timeout",   error: Error }} ConfirmResult
 *
 * @typedef {(stargate: unknown, txHash: string) => Promise<ConfirmResult>} ConfirmStrategy
 */

/** @type {Map<string, (detail: { hash: string, height?: number, code?: number }) => void>} */
const grassWaiters = new Map();

/**
 * Called by TxListener when GRASS reports a tx result.
 * @param {{ hash?: string, height?: number, code?: number }} detail
 */
export function notifyGrassTxConfirmed(detail) {
  const hash = detail?.hash;
  if (!hash) return;
  const waiter = grassWaiters.get(hash);
  if (!waiter) return;
  grassWaiters.delete(hash);
  waiter({ hash, height: detail.height, code: detail.code });
}

/**
 * Polls `getTx` with exponential backoff. Falls back to "timeout" after maxMs.
 * @type {ConfirmStrategy}
 */
export const pollingConfirmStrategy = async function pollingConfirmStrategy(stargate, txHash) {
  const maxMs = 30_000;
  const start = Date.now();
  let delay = 500;
  while (Date.now() - start < maxMs) {
    try {
      const result = await /** @type {{ getTx: (hash: string) => Promise<{ code: number, height: number } | null> }} */ (stargate).getTx(txHash);
      if (result) {
        if (result.code === 0) {
          return { status: "confirmed", height: result.height, txResult: result };
        }
        return { status: "failed", error: new Error(`Tx ${txHash} failed with code ${result.code}`) };
      }
    } catch (e) {
      void e;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.6, 4000);
  }
  return { status: "timeout", error: new Error(`Tx ${txHash} not confirmed within ${maxMs}ms`) };
};

const GRASS_WAIT_MS = 20_000;

/**
 * Wait for GRASS tx event, then fall back to polling.
 * @type {ConfirmStrategy}
 */
export const hybridConfirmStrategy = async function hybridConfirmStrategy(stargate, txHash) {
  const grassResult = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      grassWaiters.delete(txHash);
      resolve(null);
    }, GRASS_WAIT_MS);

    grassWaiters.set(txHash, (detail) => {
      clearTimeout(timeout);
      const code = detail.code ?? 0;
      if (code === 0) {
        resolve({ status: "confirmed", height: detail.height ?? 0, txResult: detail });
      } else {
        resolve({ status: "failed", error: new Error(`Tx ${txHash} failed with code ${code}`) });
      }
    });
  });

  if (grassResult) return /** @type {ConfirmResult} */ (grassResult);
  return pollingConfirmStrategy(stargate, txHash);
};
