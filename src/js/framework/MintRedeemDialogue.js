import * as bsModal from "bootstrap/js/dist/modal.js";
import { floatingLabelField } from "../view_models/components/FloatingLabelField.js";
import { notify } from "../store/notify.js";
import { readFormValues, validateForm, required, pattern } from "../util/validate.js";

/**
 * Figma Minting Tokens + Redeem Tokens flows — modal, not a page.
 * Steps: amount form → Previous/New confirm → Ok enqueues via caller.
 *
 * @param {{
 *   mode: "mint" | "redeem",
 *   tokenLabel?: string,
 *   denom?: string,
 *   collateralBalance?: number | null,
 *   totalSupply?: number | null,
 * }} options
 * @returns {Promise<
 *   | null
 *   | { mode: "mint", amountAlpha: string, amountToken: string, preview: ReturnType<typeof buildPreview> }
 *   | { mode: "redeem", amount: string, denom: string, preview: ReturnType<typeof buildPreview> }
 * >}
 */
export function openMintRedeemDialogue(options) {
  const mode = options.mode === "redeem" ? "redeem" : "mint";
  const tokenLabel = String(options.tokenLabel || "guild token");
  const denomDefault = String(options.denom || "ualpha");
  const collateral = toFiniteNumber(options.collateralBalance);
  const supply = toFiniteNumber(options.totalSupply);
  const ratio = ratioOf(supply, collateral);

  return new Promise((resolve) => {
    const layer = document.getElementById("notification-layer");
    if (!layer) {
      resolve(null);
      return;
    }

    const id = `sg-mint-redeem-${Date.now()}`;
    /** @type {"form" | "confirm"} */
    let step = "form";
    /** @type {{ amountToken: string, amountAlpha: string, amount: string, denom: string, tokenLabel: string }} */
    let draft = {
      amountToken: "",
      amountAlpha: "",
      amount: "",
      denom: denomDefault,
      tokenLabel,
    };
    /** @type {boolean} */
    let tokenMenuOpen = false;

    const convertedAlpha = () => {
      const amt = Number(stripCommas(draft.amount)) || 0;
      return estimateRedeemCollateral(amt, supply, collateral);
    };

    const renderTokenMenu = () => {
      if (!tokenMenuOpen) return "";
      return `
        <div class="sg-token-menu" role="listbox" aria-label="Select token">
          <div class="sg-token-menu__search">
            <i class="bi bi-search" aria-hidden="true"></i>
            <input type="search" class="sg-token-menu__input" placeholder="Search" data-role="token-search" autocomplete="off" />
          </div>
          <button type="button" class="sg-token-menu__option" role="option" data-action="pick-token" data-label="${escapeAttr(tokenLabel)}" data-denom="${escapeAttr(denomDefault)}">
            ${escapeHtml(tokenLabel)}${supply != null ? ` (${formatNumber(supply)})` : ""}
          </button>
        </div>`;
    };

    const renderForm = () => {
      if (mode === "mint") {
        return `
          <p class="sg-mint-modal__lead">How much would you like to Mint?</p>
          <form id="${id}-form" class="sg-mint-modal__form" novalidate>
            ${floatingLabelField({
              id: `${id}-amount-token`,
              name: "amount_token",
              label: `Amount (${tokenLabel})`,
              value: draft.amountToken,
              placeholder: "0",
            })}
            ${floatingLabelField({
              id: `${id}-amount-alpha`,
              name: "amount_alpha",
              label: "Collateral to Add (g)",
              value: draft.amountAlpha,
              placeholder: "0",
            })}
          </form>
          <div class="sg-mint-modal__stats">
            <p class="sg-mint-modal__stat">
              <span class="sg-mint-modal__stat-label">Alpha Collateral Balance:</span>
              <span class="sg-mint-modal__stat-value">${escapeHtml(formatQty(collateral, " g"))}</span>
              ${infoTipTrigger("collateral", "About Alpha Collateral Balance")}
            </p>
            <p class="sg-mint-modal__stat">
              <span class="sg-mint-modal__stat-label">Total Supply:</span>
              <span class="sg-mint-modal__stat-value">${escapeHtml(formatQty(supply, ""))}</span>
              ${infoTipTrigger("supply", "About Total Supply")}
            </p>
          </div>`;
      }

      const converted = convertedAlpha();
      return `
        <p class="sg-mint-modal__lead">How many tokens would you like to Redeem?</p>
        <form id="${id}-form" class="sg-mint-modal__form" novalidate>
          <div class="sg-token-select">
            <button type="button" class="sg-btn-lunar sg-token-select__btn" data-action="toggle-token" aria-expanded="${tokenMenuOpen ? "true" : "false"}">
              ${escapeHtml(draft.tokenLabel || "Select Token")}
              <i class="bi bi-caret-down-fill" aria-hidden="true"></i>
            </button>
            ${renderTokenMenu()}
          </div>
          ${floatingLabelField({
            id: `${id}-amount`,
            name: "amount",
            label: "Redeem Amount",
            value: draft.amount,
            placeholder: "0",
          })}
          <p class="sg-mint-modal__converted">
            <span>Alpha Converted Amount: </span>
            <strong class="sg-mint-modal__converted-value" data-role="converted-alpha">${escapeHtml(formatQty(converted, " g"))}</strong>
            ${infoTipTrigger("alphaReceive", "About Alpha Converted Amount")}
          </p>
        </form>
        <div class="sg-mint-modal__stats">
          <p class="sg-mint-modal__stat">
            <span class="sg-mint-modal__stat-label">Alpha Collateral Balance:</span>
            <span class="sg-mint-modal__stat-value">${escapeHtml(formatQty(collateral, "g"))}</span>
            ${infoTipTrigger("collateral", "About Alpha Collateral Balance")}
          </p>
          <p class="sg-mint-modal__stat">
            <span class="sg-mint-modal__stat-label">Your Collateral Ratio:</span>
            <span class="sg-mint-modal__stat-value">${escapeHtml(formatRatio(ratio))}</span>
            ${infoTipTrigger("ratio", "About Collateral Ratio")}
          </p>
        </div>`;
    };

    const renderConfirm = () => {
      const preview = buildPreview(mode, draft, collateral, supply);
      if (mode === "redeem") {
        return `
          <p class="sg-mint-modal__lead">
            You are about to redeem <strong>${escapeHtml(draft.amount)} ${escapeHtml(draft.tokenLabel)}.</strong><br /><br />
            Review the summary before making changes.
          </p>
          <div class="sg-mint-modal__compare" role="table" aria-label="Previous and new balances">
            <div class="sg-mint-modal__compare-cols">
              <div class="sg-mint-modal__compare-col">
                <div class="sg-mint-modal__compare-head">Previous</div>
                ${compareBlock("Supply", preview.prevSupply)}
                ${compareBlock("Alpha Collateral Balance", preview.prevCollateral)}
                ${compareBlock("", "")}
              </div>
              <div class="sg-mint-modal__compare-col">
                <div class="sg-mint-modal__compare-head">New</div>
                ${compareBlock("Supply", preview.nextSupply, preview.deltaSupply)}
                ${compareBlock("Alpha Collateral Balance", preview.nextCollateral, preview.deltaCollateral)}
                ${compareBlock("Alpha Receiving", preview.alphaReceiving ?? "—")}
              </div>
            </div>
            <div class="sg-mint-modal__compare-foot" aria-hidden="true"></div>
          </div>`;
      }
      return `
        <p class="sg-mint-modal__lead">
          You are about to mint tokens, please review your request here.<br />
          If it is as expected please select ok to proceed with Minting process.
        </p>
        <div class="sg-mint-modal__compare" role="table" aria-label="Previous and new balances">
          <div class="sg-mint-modal__compare-cols">
            <div class="sg-mint-modal__compare-col">
              <div class="sg-mint-modal__compare-head">Previous</div>
              ${compareBlock("Supply", preview.prevSupply)}
              ${compareBlock("Alpha Collateral Balance", preview.prevCollateral)}
              ${compareBlock("Collateral Ratio", preview.prevRatio)}
            </div>
            <div class="sg-mint-modal__compare-col">
              <div class="sg-mint-modal__compare-head">New</div>
              ${compareBlock("Supply", preview.nextSupply, preview.deltaSupply)}
              ${compareBlock("Alpha Collateral Balance", preview.nextCollateral, preview.deltaCollateral)}
              ${compareBlock("Collateral Ratio", preview.nextRatio, preview.deltaRatio)}
            </div>
          </div>
          <div class="sg-mint-modal__compare-foot" aria-hidden="true"></div>
        </div>`;
    };

    const renderBody = () => {
      const heading = step === "confirm" ? "Are you sure?" : mode === "mint" ? "Mint Tokens" : "Redeem Tokens";
      const primary = step === "confirm" || mode === "redeem" ? "Ok" : "Next";
      return `
        <div class="sg-mint-modal">
          <div class="sg-mint-modal__header">
            <button type="button" class="sg-mint-modal__back" data-action="back" aria-label="Back">
              <i class="bi bi-chevron-left" aria-hidden="true"></i>
            </button>
            <h5 class="sg-mint-modal__title">${heading}</h5>
          </div>
          <div class="sg-mint-modal__body">
            ${step === "confirm" ? renderConfirm() : renderForm()}
          </div>
          <div class="sg-mint-modal__footer">
            <button type="button" class="sg-btn-lunar sg-mint-modal__btn" data-action="cancel">Cancel</button>
            <button type="button" class="sg-btn-space sg-mint-modal__btn" data-action="primary">${primary}</button>
          </div>
        </div>`;
    };

    layer.insertAdjacentHTML(
      "beforeend",
      `<div id="${id}" class="modal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered sg-mint-modal__dialog">
          <div class="modal-content sg-mint-modal__content">
            <div class="modal-body p-0" data-role="body">${renderBody()}</div>
          </div>
        </div>
      </div>`,
    );

    const el = document.getElementById(id);
    if (!el) {
      resolve(null);
      return;
    }

    const ModalCtor = /** @type {any} */ (bsModal).default ?? bsModal;
    const modal = new ModalCtor(el);
    const body = /** @type {HTMLElement} */ (el.querySelector('[data-role="body"]'));

    /** @type {(() => void) | null} */
    let disposeInfoTips = null;

    const cleanup = (result) => {
      disposeInfoTips?.();
      disposeInfoTips = null;
      modal.hide();
      el.addEventListener("hidden.bs.modal", () => el.remove(), { once: true });
      resolve(result);
    };

    const readDraftFromForm = () => {
      const form = /** @type {HTMLFormElement | null} */ (el.querySelector(`#${id}-form`));
      if (!form) return false;
      const v = readFormValues(form);
      if (mode === "mint") {
        const { valid, errors } = validateForm(
          {
            amount_token: [required(), pattern(/^\d[\d,]*$/, "Whole numbers only")],
            amount_alpha: [required(), pattern(/^\d[\d,]*$/, "Whole numbers only")],
          },
          v,
        );
        if (!valid) {
          notify.formError(`${id}-form`, errors);
          return false;
        }
        draft.amountToken = stripCommas(v.amount_token);
        draft.amountAlpha = stripCommas(v.amount_alpha);
        return true;
      }
      const { valid, errors } = validateForm(
        {
          amount: [required(), pattern(/^\d[\d,]*$/, "Whole numbers only")],
        },
        v,
      );
      if (!valid) {
        notify.formError(`${id}-form`, errors);
        return false;
      }
      if (!draft.denom) {
        notify.formError(`${id}-form`, { amount: "Select a token first" });
        return false;
      }
      draft.amount = stripCommas(v.amount);
      return true;
    };

    const rebind = () => {
      if (!body) return;
      disposeInfoTips?.();
      body.innerHTML = renderBody();
      disposeInfoTips = bindInfoTips(body, INFO_TIP_COPY);
      body.querySelector('[data-action="cancel"]')?.addEventListener("click", () => cleanup(null));
      body.querySelector('[data-action="back"]')?.addEventListener("click", () => {
        if (step === "confirm") {
          step = "form";
          tokenMenuOpen = false;
          rebind();
          return;
        }
        cleanup(null);
      });
      body.querySelector('[data-action="toggle-token"]')?.addEventListener("click", (e) => {
        e.preventDefault();
        tokenMenuOpen = !tokenMenuOpen;
        rebind();
      });
      body.querySelector('[data-action="pick-token"]')?.addEventListener("click", (e) => {
        const btn = /** @type {HTMLElement} */ (e.currentTarget);
        draft.tokenLabel = btn.getAttribute("data-label") || tokenLabel;
        draft.denom = btn.getAttribute("data-denom") || denomDefault;
        tokenMenuOpen = false;
        rebind();
      });
      const amountInput = /** @type {HTMLInputElement | null} */ (body.querySelector(`#${id}-amount`));
      amountInput?.addEventListener("input", () => {
        draft.amount = stripCommas(amountInput.value);
        const convertedEl = body.querySelector('[data-role="converted-alpha"]');
        if (convertedEl) convertedEl.textContent = formatQty(convertedAlpha(), " g");
      });
      body.querySelector('[data-action="primary"]')?.addEventListener("click", () => {
        if (step === "form") {
          if (!readDraftFromForm()) return;
          step = "confirm";
          tokenMenuOpen = false;
          rebind();
          return;
        }
        if (mode === "mint") {
          cleanup({
            mode: "mint",
            amountAlpha: draft.amountAlpha,
            amountToken: draft.amountToken,
            preview: buildPreview(mode, draft, collateral, supply),
          });
        } else {
          cleanup({
            mode: "redeem",
            amount: draft.amount,
            denom: draft.denom,
            preview: buildPreview(mode, draft, collateral, supply),
          });
        }
      });
    };

    rebind();
    modal.show();
  });
}

/**
 * Confiscate & burn — single-step modal (same shell as mint/redeem).
 *
 * @param {{ playerPrefill?: string, tokenLabel?: string }} options
 * @returns {Promise<{ fromAddress: string, amountToken: string } | null>}
 */
export function openConfiscateDialogue(options = {}) {
  return new Promise((resolve) => {
    const layer = document.getElementById("notification-layer");
    if (!layer) {
      resolve(null);
      return;
    }
    const id = `sg-confiscate-${Date.now()}`;
    const tokenLabel = String(options.tokenLabel || "guild token");
    const prefill = String(options.playerPrefill || "");

    layer.insertAdjacentHTML(
      "beforeend",
      `<div id="${id}" class="modal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered sg-mint-modal__dialog">
          <div class="modal-content sg-mint-modal__content">
            <div class="modal-body p-0">
              <div class="sg-mint-modal">
                <div class="sg-mint-modal__header">
                  <button type="button" class="sg-mint-modal__back" data-action="cancel" aria-label="Close">
                    <i class="bi bi-chevron-left" aria-hidden="true"></i>
                  </button>
                  <h5 class="sg-mint-modal__title">Confiscate &amp; Burn</h5>
                </div>
                <div class="sg-mint-modal__body">
                  <p class="sg-mint-modal__lead">Seize tokens from a player address and burn them.</p>
                  <form id="${id}-form" class="sg-mint-modal__form" novalidate>
                    ${floatingLabelField({
                      id: `${id}-from`,
                      name: "from_address",
                      label: "From address",
                      value: prefill,
                    })}
                    ${floatingLabelField({
                      id: `${id}-amount`,
                      name: "amount_token",
                      label: `Amount (${tokenLabel})`,
                      placeholder: "0",
                    })}
                  </form>
                </div>
                <div class="sg-mint-modal__footer">
                  <button type="button" class="sg-btn-lunar sg-mint-modal__btn" data-action="cancel">Cancel</button>
                  <button type="button" class="sg-btn-danger-fill sg-mint-modal__btn" data-action="confirm">Confiscate &amp; burn</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`,
    );

    const el = document.getElementById(id);
    if (!el) {
      resolve(null);
      return;
    }
    const ModalCtor = /** @type {any} */ (bsModal).default ?? bsModal;
    const modal = new ModalCtor(el);
    const cleanup = (result) => {
      modal.hide();
      el.addEventListener("hidden.bs.modal", () => el.remove(), { once: true });
      resolve(result);
    };
    el.querySelectorAll('[data-action="cancel"]').forEach((b) => b.addEventListener("click", () => cleanup(null)));
    el.querySelector('[data-action="confirm"]')?.addEventListener("click", () => {
      const form = /** @type {HTMLFormElement} */ (el.querySelector(`#${id}-form`));
      const v = readFormValues(form);
      const { valid, errors } = validateForm(
        {
          from_address: [required()],
          amount_token: [required(), pattern(/^\d[\d,]*$/, "Whole numbers only")],
        },
        v,
      );
      if (!valid) return notify.formError(`${id}-form`, errors);
      cleanup({ fromAddress: String(v.from_address).trim(), amountToken: stripCommas(v.amount_token) });
    });
    modal.show();
  });
}

/**
 * Figma alert bubbles — mint (`2314:78199`/`78198`) + redeem (`2314:79059`/`79058`/`79060`).
 * @type {Record<string, string>}
 */
const INFO_TIP_COPY = {
  collateral: "Total Alpha Matter held as collateral backing for guild’s token",
  supply: "Total amount of guild’s token that exist across all players",
  ratio: "Exchange rate for the guild's Alpha Matter reserves divided by its total tokens in circulation.",
  alphaReceive: "The amount of Alpha Matter you'll receive for the redeemed tokens, based on the guild's exchange rate.",
};

/**
 * @param {string} key
 * @param {string} ariaLabel
 */
function infoTipTrigger(key, ariaLabel) {
  return `
    <button
      type="button"
      class="sg-info-tip__trigger"
      data-info-tip="${escapeAttr(key)}"
      aria-label="${escapeAttr(ariaLabel)}"
      aria-expanded="false"
    >
      <i class="bi bi-info-circle" aria-hidden="true"></i>
    </button>`;
}

/**
 * Click-to-toggle cream info popovers (Figma alert, caret on the left).
 *
 * @param {ParentNode} root
 * @param {Record<string, string>} copyByKey
 * @returns {() => void}
 */
function bindInfoTips(root, copyByKey) {
  /** @type {HTMLElement | null} */
  let openTip = null;
  /** @type {HTMLElement | null} */
  let openTrigger = null;

  const close = () => {
    openTip?.remove();
    openTip = null;
    if (openTrigger) {
      openTrigger.setAttribute("aria-expanded", "false");
      openTrigger = null;
    }
  };

  /**
   * @param {HTMLElement} trigger
   * @param {string} text
   */
  const open = (trigger, text) => {
    close();
    const tip = document.createElement("div");
    tip.className = "sg-info-tip";
    tip.setAttribute("role", "tooltip");
    tip.innerHTML = `<p class="sg-info-tip__text">${escapeHtml(text)}</p>`;
    document.body.appendChild(tip);

    const rect = trigger.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const gap = 10;
    let top = rect.top + rect.height / 2 - tipRect.height / 2;
    let left = rect.right + gap;
    const pad = 8;
    if (left + tipRect.width > window.innerWidth - pad) {
      left = Math.max(pad, rect.left - tipRect.width - gap);
      tip.classList.add("sg-info-tip--left");
    }
    top = Math.max(pad, Math.min(top, window.innerHeight - tipRect.height - pad));
    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;

    openTip = tip;
    openTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");
  };

  /** @param {MouseEvent} e */
  const onClick = (e) => {
    const target = /** @type {HTMLElement | null} */ (e.target instanceof Element ? e.target.closest("[data-info-tip]") : null);
    if (target && root.contains(target)) {
      e.preventDefault();
      e.stopPropagation();
      const key = target.getAttribute("data-info-tip") || "";
      const text = copyByKey[key];
      if (!text) return;
      if (openTrigger === target) {
        close();
        return;
      }
      open(target, text);
      return;
    }
    if (openTip && e.target instanceof Node && openTip.contains(e.target)) return;
    close();
  };

  /** @param {KeyboardEvent} e */
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };

  /** @param {Event} e */
  const onScroll = (e) => {
    if (!openTip) return;
    if (e.target instanceof Node && openTip.contains(e.target)) return;
    close();
  };

  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", close);

  return () => {
    close();
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", close);
  };
}

/**
 * @param {string} label
 * @param {string} value
 * @param {{ text: string, tone: "up" | "down" | "neutral" } | null} [delta]
 */
function compareBlock(label, value, delta = null) {
  const deltaHtml = delta
    ? ` <span class="sg-mint-modal__delta sg-mint-modal__delta--${delta.tone}">${escapeHtml(delta.text)}</span>`
    : "";
  return `
    <div class="sg-mint-modal__compare-label">${escapeHtml(label)}</div>
    <div class="sg-mint-modal__compare-value">${escapeHtml(value)}${deltaHtml}</div>`;
}

/**
 * @param {"mint" | "redeem"} mode
 * @param {{ amountToken: string, amountAlpha: string, amount: string }} draft
 * @param {number | null} collateral
 * @param {number | null} supply
 */
function buildPreview(mode, draft, collateral, supply) {
  const tokenDelta = Number(mode === "mint" ? draft.amountToken : draft.amount) || 0;
  const alphaDelta = Number(draft.amountAlpha) || 0;
  const redeemCollateral =
    mode === "redeem" ? estimateRedeemCollateral(tokenDelta, supply, collateral) : 0;

  const nextSupply =
    supply == null ? null : mode === "mint" ? supply + tokenDelta : Math.max(0, supply - tokenDelta);
  const nextCollateral =
    collateral == null
      ? null
      : mode === "mint"
        ? Math.max(0, collateral - alphaDelta)
        : Math.max(0, collateral - redeemCollateral);

  const prevRatio = ratioOf(supply, collateral);
  const nextRatio = ratioOf(nextSupply, nextCollateral);

  const supplyChange = mode === "mint" ? tokenDelta : -tokenDelta;
  // Redeem: collateral leaves the bank to the redeemer (balance down); Alpha Receiving is the payout.
  const collateralChange = mode === "mint" ? -alphaDelta : -redeemCollateral;

  return {
    prevSupply: formatQty(supply, ""),
    nextSupply: formatQty(nextSupply, ""),
    deltaSupply: deltaFromChange(supply, nextSupply, supplyChange, ""),
    prevCollateral: formatQty(collateral, " g"),
    nextCollateral: formatQty(nextCollateral, " g"),
    deltaCollateral: deltaFromChange(collateral, nextCollateral, collateralChange, ""),
    prevRatio: formatRatio(prevRatio),
    nextRatio: formatRatio(nextRatio),
    deltaRatio: deltaPart(prevRatio, nextRatio, "", 1),
    alphaReceiving: mode === "redeem" ? formatQty(redeemCollateral, " g") : null,
    alphaReceivingRaw: mode === "redeem" ? redeemCollateral : null,
  };
}

/**
 * Prefer computed prev→next; if baseline is missing, still show the form delta.
 *
 * @param {number | null} prev
 * @param {number | null} next
 * @param {number} change
 * @param {string} suffix
 * @param {number} [digits]
 */
function deltaFromChange(prev, next, change, suffix, digits = 0) {
  if (prev != null && next != null) return deltaPart(prev, next, suffix, digits);
  if (!change || !Number.isFinite(change)) return null;
  const abs = digits > 0 ? Math.abs(change).toFixed(digits) : formatNumber(Math.abs(change));
  const sign = change > 0 ? "+" : "-";
  return {
    text: `(${sign}${abs}${suffix})`,
    tone: change > 0 ? /** @type {"up"} */ ("up") : /** @type {"down"} */ ("down"),
  };
}

/** @param {number} tokenAmt @param {number | null} supply @param {number | null} collateral */
function estimateRedeemCollateral(tokenAmt, supply, collateral) {
  if (supply == null || collateral == null || supply <= 0) return 0;
  return Math.round((tokenAmt / supply) * collateral);
}

/** @param {number | null} supply @param {number | null} collateral */
function ratioOf(supply, collateral) {
  if (supply == null || collateral == null || collateral <= 0) return null;
  return supply / collateral;
}

/**
 * @param {number | null} prev
 * @param {number | null} next
 * @param {string} suffix
 * @param {number} [digits]
 */
function deltaPart(prev, next, suffix, digits = 0) {
  if (prev == null || next == null) return null;
  const d = next - prev;
  if (Math.abs(d) < 1e-9) return { text: `(+0${suffix})`, tone: /** @type {"neutral"} */ ("neutral") };
  const abs = digits > 0 ? Math.abs(d).toFixed(digits) : formatNumber(Math.abs(d));
  const sign = d > 0 ? "+" : "-";
  return {
    text: `(${sign}${abs}${suffix})`,
    tone: d > 0 ? /** @type {"up"} */ ("up") : /** @type {"down"} */ ("down"),
  };
}

/** @param {number | null} n @param {string} suffix */
function formatQty(n, suffix) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${formatNumber(n)}${suffix}`;
}

/** @param {number | null} n */
function formatRatio(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

/** @param {number} n */
function formatNumber(n) {
  return Math.round(n).toLocaleString("en-US");
}

/** @param {unknown} v */
function toFiniteNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** @param {string} s */
function stripCommas(s) {
  return String(s ?? "").replace(/,/g, "").trim();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}
