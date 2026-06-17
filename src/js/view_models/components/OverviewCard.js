/**
 * Overview page cards — Figma Flows Overview-final (1920:64583).
 */

/**
 * @param {{ title: string, subtitle?: string, showMenu?: boolean }} props
 * @returns {string}
 */
export function overviewCardHeader(props) {
  const menu =
    props.showMenu !== false
      ? `<button type="button" class="sg-overview-card__menu" aria-label="More options"><i class="bi bi-three-dots"></i></button>`
      : "";
  return `
    <div class="sg-overview-card__header">
      <div class="sg-overview-card__meta">
        <h2 class="sg-overview-card__title sg-type-headline">${escapeHtml(props.title)}</h2>
        ${props.subtitle ? `<p class="sg-overview-card__subtitle sg-type-subtitle">${escapeHtml(props.subtitle)}</p>` : ""}
      </div>
      ${menu}
    </div>
  `;
}

/**
 * @param {{
 *   icon: string,
 *   iconTone?: "blue" | "default",
 *   label: string,
 *   columns: Array<{
 *     period?: string,
 *     value: string,
 *     rank?: string,
 *     rankTone?: "success" | "warning" | "error" | "neutral",
 *     rankDirection?: "up" | "down" | "neutral",
 *   }>,
 * }} props
 * @returns {string}
 */
export function overviewMetricRow(props) {
  const iconTone = props.iconTone ?? "default";
  const primary = props.columns[0];
  const periods = props.columns.slice(1);

  const periodLabelCells = periods
    .map((col) => `<div class="sg-overview-metric__period-label">${escapeHtml(col.period ?? "")}</div>`)
    .join("");

  const periodValueCells = periods
    .map((col) => `<div class="sg-overview-metric__period-value">${renderMetricValue(col)}</div>`)
    .join("");

  return `
    <div class="sg-overview-metric">
      <div class="sg-overview-metric__metric-label">
        <span class="sg-overview-icon-well sg-overview-icon-well--${iconTone}" aria-hidden="true">
          <span class="sg-overview-icon-well__inner"><i class="bi ${escapeAttr(props.icon)}"></i></span>
        </span>
        <span class="sg-overview-metric__label">${escapeHtml(props.label)}</span>
      </div>
      ${periodLabelCells}
      <div class="sg-overview-metric__metric-value">
        ${primary ? renderMetricValue(primary) : `<span class="sg-overview-metric__value">—</span>`}
      </div>
      ${periodValueCells}
    </div>
  `;
}

/**
 * @param {{
 *   name: string,
 *   avatarText?: string,
 *   columns: Array<{
 *     period: string,
 *     value: string,
 *     rank?: string,
 *     rankTone?: "success" | "warning" | "error" | "neutral",
 *     rankDirection?: "up" | "down" | "neutral",
 *   }>,
 * }} props
 * @returns {string}
 */
export function overviewLeaderboardRow(props) {
  const initial = (props.avatarText ?? props.name[0] ?? "?").toUpperCase();
  const cols = props.columns
    .map(
      (col) => `
        <div class="sg-overview-leaderboard__column">
          <div class="sg-overview-metric__cell sg-overview-metric__cell--label">${escapeHtml(col.period)}</div>
          <div class="sg-overview-metric__cell sg-overview-metric__cell--value">
            ${renderMetricValue(col)}
          </div>
        </div>
      `,
    )
    .join("");

  return `
    <div class="sg-overview-leaderboard__row">
      <div class="sg-overview-leaderboard__guild">
        <div class="sg-overview-leaderboard__cell sg-overview-leaderboard__cell--label">
          <span class="sg-overview-leaderboard__avatar" aria-hidden="true">${escapeHtml(initial)}</span>
          <span class="sg-overview-leaderboard__name">${escapeHtml(props.name)}</span>
        </div>
        <div class="sg-overview-leaderboard__cell sg-overview-leaderboard__cell--spacer" aria-hidden="true"></div>
      </div>
      ${cols}
    </div>
  `;
}

/** @returns {string} */
export function overviewActivitySeeAll() {
  return `<a class="sg-overview-activity__action" href="/alerts" data-spa-link>See all activities</a>`;
}

/**
 * @param {{
 *   icon: string,
 *   iconTone?: "success" | "info" | "warning" | "error" | "neutral",
 *   title: string,
 *   time?: string,
 *   body?: string,
 *   actionLabel?: string,
 *   actionHref?: string,
 * }} props
 * @returns {string}
 */
export function overviewActivityItem(props) {
  const tone = props.iconTone ?? "neutral";
  const action =
    props.actionLabel && props.actionHref
      ? `<a class="sg-overview-activity__action" href="${escapeAttr(props.actionHref)}" data-spa-link>${escapeHtml(props.actionLabel)}</a>`
      : props.actionLabel
        ? `<button type="button" class="sg-overview-activity__action" disabled>${escapeHtml(props.actionLabel)}</button>`
        : "";

  return `
    <article class="sg-overview-activity__item">
      <div class="sg-overview-activity__head">
        <div class="sg-overview-activity__title-row">
          <i class="bi ${escapeAttr(props.icon)} sg-overview-activity__icon sg-overview-activity__icon--${tone}" aria-hidden="true"></i>
          <h3 class="sg-overview-activity__title">${escapeHtml(props.title)}</h3>
        </div>
        ${props.time ? `<time class="sg-overview-activity__time">${escapeHtml(props.time)}</time>` : ""}
      </div>
      ${props.body ? `<p class="sg-overview-activity__body">${escapeHtml(props.body)}</p>` : ""}
      ${action}
    </article>
  `;
}

/**
 * @param {{
 *   value: string,
 *   rank?: string,
 *   rankTone?: "success" | "warning" | "error" | "neutral",
 *   rankDirection?: "up" | "down" | "neutral",
 * }} col
 */
function renderMetricValue(col) {
  const rank = col.rank
    ? `<span class="sg-overview-rank sg-overview-rank--${col.rankTone ?? "neutral"}">${rankIcon(col.rankDirection)}<span>${escapeHtml(col.rank)}</span></span>`
    : "";
  return `<span class="sg-overview-metric__value">${escapeHtml(col.value)}</span>${rank}`;
}

/** @param {"up" | "down" | "neutral" | undefined} direction */
function rankIcon(direction) {
  if (direction === "up") return `<i class="bi bi-arrow-up-short" aria-hidden="true"></i>`;
  if (direction === "down") return `<i class="bi bi-arrow-down-short" aria-hidden="true"></i>`;
  if (direction === "neutral") return `<i class="bi bi-arrow-left-right" aria-hidden="true"></i>`;
  return "";
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
