/**
 * The layered render configuration for a profile picture. Each property is a
 * 1-based index into that layer's PNG set (or null to skip the layer).
 *
 * Ported from references/structs-webapp/src/js/models/PfpClientRenderAttributes.js.
 * The Guild API delivers this as a JSON string on the `pfp_client_render_attributes`
 * field; use `fromJson` to parse it.
 */
export class PfpClientRenderAttributes {
  /**
   * @param {number|null} head
   * @param {number|null} neck
   * @param {number|null} body
   * @param {number|null} arms
   * @param {number|null} background
   */
  constructor(head = null, neck = null, body = null, arms = null, background = null) {
    this.head = head;
    this.neck = neck;
    this.body = body;
    this.arms = arms;
    this.background = background;
  }

  /**
   * Build from a JSON string, a plain object, or null. Returns null when the
   * input is empty or cannot be parsed.
   *
   * @param {string|object|null|undefined} value
   * @returns {PfpClientRenderAttributes|null}
   */
  static fromJson(value) {
    if (value === null || value === undefined) return null;

    let obj = value;
    if (typeof value === "string") {
      if (value.trim().length === 0) return null;
      try {
        obj = JSON.parse(value);
      } catch {
        return null;
      }
    }

    if (!obj || typeof obj !== "object") return null;

    const o = /** @type {Record<string, number|null|undefined>} */ (obj);
    return new PfpClientRenderAttributes(
      o.head ?? null,
      o.neck ?? null,
      o.body ?? null,
      o.arms ?? null,
      o.background ?? null,
    );
  }
}
