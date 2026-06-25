import { PFP_PART_COUNTS, PFP_LAYER_ORDER, PFP_ASSET_BASE, PFP_PLACEHOLDER } from "@/constants/PfpConstants.js";
import { PfpClientRenderAttributes } from "@/models/PfpClientRenderAttributes.js";

/**
 * Composes and displays a player's profile picture from its layered render
 * attributes. Built from 5 same-size PNG layers painted back to front
 * (background, arms, body, neck, head). When there are no attributes the
 * portrait placeholder is shown instead.
 *
 * Ported from references/structs-webapp/src/js/view_models/components/PfpViewerComponent.js.
 * Layers fill their container (width/height 100%) so the avatar scales to any
 * `.sg-pfp` size.
 */
export class PfpViewer {
  /**
   * @param {PfpClientRenderAttributes|null} pfpClientRenderAttributes
   * @param {boolean} generateRandom whether to randomly generate a configuration
   */
  constructor(pfpClientRenderAttributes = null, generateRandom = false) {
    this.pfp = generateRandom ? this.generateRandomPfp() : pfpClientRenderAttributes || null;
    /** @type {HTMLElement|null} */
    this.containerElement = null;
  }

  /**
   * Serialize the current configuration for persistence / on-chain update.
   * @returns {string|null}
   */
  getPfpJson() {
    if (this.pfp && typeof this.pfp === "object") return JSON.stringify(this.pfp);
    return null;
  }

  /**
   * @returns {PfpClientRenderAttributes}
   */
  generateRandomPfp() {
    const randomPart = (count) => Math.floor(Math.random() * count) + 1;
    return new PfpClientRenderAttributes(
      randomPart(PFP_PART_COUNTS.head),
      randomPart(PFP_PART_COUNTS.neck),
      randomPart(PFP_PART_COUNTS.body),
      randomPart(PFP_PART_COUNTS.arms),
      randomPart(PFP_PART_COUNTS.background),
    );
  }

  /**
   * Inner HTML for the picture, intended to sit inside a sized `.sg-pfp`
   * container (see `pfpAvatar` and `_pfp.scss`).
   * @returns {string}
   */
  renderHTML() {
    if (!this.pfp) {
      return `<img class="pfp-viewer-layer" src="${PFP_PLACEHOLDER}" alt="Profile picture">`;
    }

    return PFP_LAYER_ORDER.map((part) => [part, this.pfp?.[part]])
      .filter(([, index]) => index !== null && index !== undefined)
      .map(
        ([part, index]) =>
          `<img class="pfp-viewer-layer" src="${PFP_ASSET_BASE}/${part}/pfp_${part}_${index}.png" alt="">`,
      )
      .join("");
  }

  /**
   * @param {HTMLElement} containerElement
   * @returns {PfpViewer}
   */
  mount(containerElement) {
    this.containerElement = containerElement;
    this.render();
    return this;
  }

  render() {
    if (this.containerElement) this.containerElement.innerHTML = this.renderHTML();
  }

  /**
   * @param {boolean} regenerate generate a fresh random configuration first
   */
  rerender(regenerate = false) {
    if (regenerate) this.pfp = this.generateRandomPfp();
    this.render();
  }
}

/**
 * Pure helper: a sized avatar container with the composed PFP inside. Matches
 * the `statCard`-style component convention for interpolation into tables and
 * headers.
 *
 * @param {{
 *   attributes?: PfpClientRenderAttributes | string | null,
 *   size?: "sm" | "md" | "lg",
 *   className?: string,
 * }} [props]
 * @returns {string}
 */
export function pfpAvatar(props = {}) {
  const size = props.size ?? "md";
  const attrs =
    typeof props.attributes === "string" || props.attributes == null
      ? PfpClientRenderAttributes.fromJson(props.attributes ?? null)
      : props.attributes;
  const inner = new PfpViewer(attrs).renderHTML();
  const extra = props.className ? ` ${props.className}` : "";
  return `<span class="sg-pfp sg-pfp--${size}${extra}" aria-hidden="true">${inner}</span>`;
}
