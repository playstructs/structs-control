/**
 * Thrown by JsonAjaxer when a Guild API request fails or the envelope reports
 * `success: false`. Carries the HTTP status and the server-supplied `errors[]`
 * array so the UI can surface them without re-parsing the response.
 */
export class GuildAPIError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, errors?: string[], url?: string, missing?: boolean }} [meta]
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = "GuildAPIError";
    this.status = meta.status ?? 0;
    this.errors = meta.errors ?? [message];
    this.url = meta.url ?? "";
    this.missing = Boolean(meta.missing);
  }
}
