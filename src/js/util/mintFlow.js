import { EVENTS } from "../constants/Events.js";
import { TX_STATUS } from "../constants/SigningQueueConstants.js";
import { notify } from "../store/notify.js";

const STORAGE_KEY = "structs.mintFlow";

const MINT_PROCESSING = "/guild/banks/mint/processing";
const MINT_COMPLETED = "/guild/banks/mint/completed";
const REDEEM_PROCESSING = "/guild/banks/redeem/processing";
const REDEEM_COMPLETED = "/guild/banks/redeem/completed";

/**
 * @typedef {{
 *   txId: string,
 *   mode: "mint" | "redeem",
 *   amountToken: string,
 *   amountAlpha: string,
 *   denom?: string,
 *   tokenLabel?: string,
 *   guildName?: string,
 *   alphaReceiving?: string | null,
 *   prevCollateral: string,
 *   nextCollateral: string,
 *   deltaCollateral: string | null,
 *   deltaCollateralTone: "up" | "down" | "neutral" | null,
 *   prevSupply: string,
 *   nextSupply: string,
 *   deltaSupply: string | null,
 *   deltaSupplyTone: "up" | "down" | "neutral" | null,
 *   prevRatio: string,
 *   nextRatio: string,
 *   deltaRatio: string | null,
 *   deltaRatioTone: "up" | "down" | "neutral" | null,
 *   settled?: boolean,
 *   successToastShown?: boolean,
 *   alertDismissed?: boolean,
 *   completedVisited?: boolean,
 * }} MintFlowState
 */

/** @type {string | null} */
let watchingTxId = null;
/** @type {((e: Event) => void) | null} */
let confirmedHandler = null;
/** @type {((e: Event) => void) | null} */
let failedHandler = null;
/** @type {((e: Event) => void) | null} */
let routeHandler = null;
/** @type {{ goto: (path: string) => void } | null} */
let activeRouter = null;

/** @returns {MintFlowState | null} */
export function readMintFlow() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return /** @type {MintFlowState} */ (JSON.parse(raw));
  } catch {
    return null;
  }
}

/** @param {MintFlowState} state */
export function saveMintFlow(state) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearMintFlow() {
  sessionStorage.removeItem(STORAGE_KEY);
}

/** @param {"mint" | "redeem"} [mode] */
export function mintProcessingPath(mode = "mint") {
  return mode === "redeem" ? REDEEM_PROCESSING : MINT_PROCESSING;
}

/** @param {"mint" | "redeem"} [mode] */
export function mintCompletedPath(mode = "mint") {
  return mode === "redeem" ? REDEEM_COMPLETED : MINT_COMPLETED;
}

/** @param {string} [path] */
export function isMintProcessingPath(path = window.location.pathname) {
  const p = String(path);
  return p.startsWith(MINT_PROCESSING) || p.startsWith(REDEEM_PROCESSING);
}

/** @param {string} [path] */
export function isMintCompletedPath(path = window.location.pathname) {
  const p = String(path);
  return p.startsWith(MINT_COMPLETED) || p.startsWith(REDEEM_COMPLETED);
}

export function markMintCompletedVisited() {
  const flow = readMintFlow();
  if (!flow) return;
  saveMintFlow({ ...flow, completedVisited: true });
}

/**
 * Keep `settled` in sync with TxQueue (`_notify` runs before `TX_CONFIRMED`).
 *
 * @param {import("../store/Store.js").Store} [store]
 * @returns {MintFlowState | null}
 */
export function syncMintFlowSettled(store) {
  const flow = readMintFlow();
  if (!flow?.txId || flow.settled) return flow;
  const rec = store?.tx?.list()?.find((r) => r.id === flow.txId);
  if (rec?.status === TX_STATUS.CONFIRMED) {
    const next = { ...flow, settled: true };
    saveMintFlow(next);
    return next;
  }
  return flow;
}

/**
 * One-shot floating Figma success toast. Safe to call from settle, route, or
 * page mounts — only renders once per flow.
 *
 * @param {{ goto: (path: string) => void } | null | undefined} [router]
 * @param {import("../store/Store.js").Store} [store]
 */
export function maybeToastMintSuccess(router, store) {
  syncMintFlowSettled(store);
  const flow = readMintFlow();
  if (!flow?.txId || !flow.settled || flow.successToastShown) return;

  const mode = flow.mode === "redeem" ? "redeem" : "mint";
  const message =
    mode === "redeem"
      ? "Recent redemption has completed. Check it out here"
      : "Recent minting has completed. Check it out here";

  saveMintFlow({ ...flow, successToastShown: true });
  notify.successToast(message, {
    timeoutMs: 10000,
    href: mintCompletedPath(mode),
    onNavigate: (path) => (router ?? activeRouter)?.goto(path),
  });
}

/**
 * Inline Figma success bar on Guild Banks (independent of the floating toast).
 * @returns {boolean}
 */
export function shouldShowMintSuccessAlert() {
  const flow = readMintFlow();
  if (!flow?.txId || flow.alertDismissed) return false;
  if (!flow.settled) return false;
  if (isMintProcessingPath() || isMintCompletedPath()) return false;
  return true;
}

export function dismissMintSuccessAlert() {
  const flow = readMintFlow();
  if (!flow) return;
  saveMintFlow({ ...flow, alertDismissed: true, successToastShown: true });
  stopMintFlowWatch();
}

/**
 * After enqueue: persist preview + watch settlement.
 *
 * @param {{
 *   txId: string,
 *   state: Omit<MintFlowState, "txId">,
 *   store: import("../store/Store.js").Store,
 *   router: { goto: (path: string) => void },
 * }} opts
 */
export function beginMintFlowWatch(opts) {
  const state = /** @type {MintFlowState} */ ({
    ...opts.state,
    txId: opts.txId,
    settled: false,
    successToastShown: false,
    alertDismissed: false,
    completedVisited: false,
  });
  saveMintFlow(state);
  stopMintFlowWatch();
  watchingTxId = opts.txId;
  activeRouter = opts.router;

  confirmedHandler = (e) => {
    const detail = /** @type {{ id?: string }} */ (/** @type {CustomEvent} */ (e).detail ?? {});
    if (detail.id !== watchingTxId) return;
    onMintSettled(opts.router, opts.store, TX_STATUS.CONFIRMED);
  };
  failedHandler = (e) => {
    const detail = /** @type {{ id?: string }} */ (/** @type {CustomEvent} */ (e).detail ?? {});
    if (detail.id !== watchingTxId) return;
    onMintSettled(opts.router, opts.store, TX_STATUS.FAILED);
  };

  window.addEventListener(EVENTS.TX_CONFIRMED, confirmedHandler);
  window.addEventListener(EVENTS.TX_FAILED, failedHandler);

  routeHandler = () => {
    maybeToastMintSuccess(opts.router, opts.store);
  };
  window.addEventListener("popstate", routeHandler);
  window.addEventListener(EVENTS.ROUTE_CHANGED, routeHandler);

  // Capture id for whenSettled — do not require watchingTxId still set (confirm
  // handler may clear it first).
  const watchedId = opts.txId;
  void opts.store.tx?.whenSettled(watchedId).then((rec) => {
    if (!rec || rec.id !== watchedId) return;
    onMintSettled(opts.router, opts.store, rec.status);
  });

  const rec = opts.store.tx?.list()?.find((r) => r.id === opts.txId);
  if (rec && (rec.status === TX_STATUS.CONFIRMED || rec.status === TX_STATUS.FAILED || rec.status === TX_STATUS.CANCELLED)) {
    onMintSettled(opts.router, opts.store, rec.status);
  }
}

export function stopMintFlowWatch() {
  if (confirmedHandler) window.removeEventListener(EVENTS.TX_CONFIRMED, confirmedHandler);
  if (failedHandler) window.removeEventListener(EVENTS.TX_FAILED, failedHandler);
  if (routeHandler) {
    window.removeEventListener("popstate", routeHandler);
    window.removeEventListener(EVENTS.ROUTE_CHANGED, routeHandler);
  }
  confirmedHandler = null;
  failedHandler = null;
  routeHandler = null;
  watchingTxId = null;
}

/**
 * @param {{ goto: (path: string) => void }} router
 * @param {import("../store/Store.js").Store} store
 * @param {string} status
 */
function onMintSettled(router, store, status) {
  const flow = readMintFlow();
  // Allow settle even if watchingTxId was cleared by a prior handler invocation.
  if (!flow?.txId) return;
  if (watchingTxId && watchingTxId !== flow.txId) return;

  if (status !== TX_STATUS.CONFIRMED) {
    stopMintFlowWatch();
    if (isMintProcessingPath() && (status === TX_STATUS.FAILED || status === TX_STATUS.CANCELLED)) {
      notify.toast(flow.mode === "redeem" ? "Redeem failed" : "Mint failed", "danger");
    }
    return;
  }

  if (!flow.settled) {
    saveMintFlow({ ...flow, settled: true });
  }

  // Always toast once on confirm — including while still on processing/completed
  // or Activity. Banks also keeps its own inline alert (separate dismiss flag).
  maybeToastMintSuccess(router, store);

  stopMintFlowWatch();
}

/**
 * Capture the next TX_ENQUEUED detail during a synchronous enqueue call.
 *
 * @param {() => Promise<unknown> | unknown} enqueueFn
 * @returns {Promise<{ id: string } | null>}
 */
export async function captureEnqueuedTx(enqueueFn) {
  /** @type {{ id: string } | null} */
  let captured = null;
  /** @param {Event} e */
  const handler = (e) => {
    const detail = /** @type {{ id?: string }} */ (/** @type {CustomEvent} */ (e).detail ?? {});
    if (detail.id) captured = { id: String(detail.id) };
  };
  window.addEventListener(EVENTS.TX_ENQUEUED, handler);
  try {
    const result = enqueueFn();
    if (result && typeof /** @type {Promise<unknown>} */ (result).then === "function") {
      // TX_ENQUEUED fires sync inside enqueue before the settled promise.
      void result;
    }
  } finally {
    window.removeEventListener(EVENTS.TX_ENQUEUED, handler);
  }
  return captured;
}

/** @deprecated internal */
export function _activeRouter() {
  return activeRouter;
}
