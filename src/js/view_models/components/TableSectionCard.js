/**
 * Figma table section — icon + title + subtitle inside the card, DataTable below.
 *
 * @param {{
 *   icon?: string,
 *   title: string,
 *   subtitle?: string,
 *   bodyHtml: string,
 * }} props
 * @returns {string}
 */
/** Shared icon for every table section header (Figma table-icon-heading, node 576:74736). */
export const TABLE_SECTION_ICON = "bi-lightning-charge";

export function tableSectionCard(props) {
  const { icon = TABLE_SECTION_ICON, title, subtitle, bodyHtml } = props;
  return `
    <section class="sg-table-section">
      <div class="sg-table-section__header">
        <div class="sg-table-section__icon" aria-hidden="true">
          <span class="sg-table-section__icon-inner"><i class="bi ${escapeAttr(icon)}"></i></span>
        </div>
        <div class="sg-table-section__meta">
          <h2 class="sg-table-section__title sg-type-table-headline">${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="sg-table-section__subtitle sg-type-table-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        </div>
      </div>
      <div class="sg-table-section__content">${bodyHtml}</div>
    </section>
  `;
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}
