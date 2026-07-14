/**
 * Energy Grid activity highlight card (Figma activity-card).
 *
 * @param {{
 *   icon: string,
 *   iconTone?: "success" | "danger" | "warning" | "blue",
 *   label: string,
 *   name: string,
 *   metric: string,
 * }} props
 * @returns {string}
 */
export function energyGridActivityCard(props) {
  const tone = props.iconTone ?? "blue";
  return `
    <article class="sg-energy-activity-card">
      <div class="sg-energy-activity-card__head">
        <div class="sg-energy-activity-card__title-row">
          <span class="sg-energy-activity-card__icon sg-energy-activity-card__icon--${escapeAttr(tone)}" aria-hidden="true">
            <i class="bi ${escapeAttr(props.icon)}"></i>
          </span>
          <span class="sg-energy-activity-card__label">${escapeHtml(props.label)}</span>
        </div>
      </div>
      <p class="sg-energy-activity-card__meta">
        <span class="sg-energy-activity-card__name">${escapeHtml(props.name)}</span>
        <span class="sg-energy-activity-card__dash">-</span>
        <span class="sg-energy-activity-card__metric">${escapeHtml(props.metric)}</span>
      </p>
    </article>
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

function escapeAttr(s) {
  return escapeHtml(s);
}
