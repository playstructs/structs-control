/**
 * Small stat tile. Pure render function -- no class needed since there's no state.
 *
 * @param {{ label: string, value?: string | number, valueHtml?: string, sub?: string }} props
 * @returns {string}
 */
export function statCard(props) {
  const valueBlock =
    props.valueHtml != null ? props.valueHtml : escapeHtml(String(props.value ?? "—"));
  return `
    <div class="sg-stat-card">
      <div class="sg-stat-card__label">${escapeHtml(props.label)}</div>
      <div class="sg-stat-card__value">${valueBlock}</div>
      ${props.sub ? `<div class="sg-stat-card__sub">${escapeHtml(props.sub)}</div>` : ""}
    </div>
  `;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
