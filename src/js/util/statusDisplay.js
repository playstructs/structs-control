/**
 * Figma-style status dot + label for table cells.
 *
 * @param {string | null | undefined} status
 * @returns {string}
 */
export function statusBadge(status) {
  const label = String(status ?? "—");
  const normalized = label.toLowerCase();
  let dotClass = "";
  if (/(online|approved|active|joined|success)/.test(normalized)) dotClass = "is-online";
  else if (/(pending|waiting|review)/.test(normalized)) dotClass = "is-pending";
  else if (/(offline|rejected|denied|failed|error)/.test(normalized)) dotClass = "is-offline";

  return `<span class="sg-status"><span class="sg-status__dot ${dotClass}" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
