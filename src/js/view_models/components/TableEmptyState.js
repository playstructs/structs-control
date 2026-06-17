/**
 * Illustrated empty state for DataTable rows — 8-bit struct sprite.
 */
export class TableEmptyState {
  /**
   * @param {{ title?: string, hint?: string, showIllustration?: boolean }} [props]
   * @returns {string}
   */
  static renderHTML(props = {}) {
    const { title = "No results.", hint, showIllustration = true } = props;
    const art = showIllustration
      ? `<div class="sg-datatable__empty-art" aria-hidden="true">${renderPixelStructSprite()}</div>`
      : "";
    const hintHtml = hint ? `<p class="sg-datatable__empty-hint">${escapeHtml(hint)}</p>` : "";

    return `<div class="sg-datatable__empty" role="status">
      ${art}
      <p class="sg-datatable__empty-title">${escapeHtml(title)}</p>
      ${hintHtml}
    </div>`;
  }
}

/** 8-bit palette — Structs purples + simple accents */
const PIXEL_PALETTE = Object.freeze({
  o: "#2d1f6e",
  d: "#4a35b8",
  p: "#6b4fd8",
  l: "#8b72e8",
  h: "#b39cff",
  w: "#f6f7f9",
  e: "#ffffff",
  b: "#1f212a",
  y: "#ffd95a",
  r: "#d94b4b",
  s: "#58617a",
  t: "#3a4050",
});

/**
 * 20×22 sprite. Each char = one pixel.
 * Struct hex body, blink-ready antenna, shrug pose.
 */
const STRUCT_SPRITE = [
  "....................",
  ".........oyy........",
  ".........oyd........",
  "........odddo.......",
  ".......oppppo.......",
  "......oppllppo......",
  ".....opplwwlppo.....",
  ".....opwbebwepo.....",
  ".....opplttlppo.....",
  "......oppppppo......",
  ".......oppppo.......",
  "......opd..odpo.....",
  ".....opd....odpo....",
  ".....opd....odpo....",
  "......odd....oddo...",
  "......odd....oddo...",
  ".....oss....osso....",
  "....................",
  "....................",
  "....................",
];

const PIXEL_SIZE = 6;

/** @returns {string} */
function renderPixelStructSprite() {
  const cols = STRUCT_SPRITE[0].length;
  const rows = STRUCT_SPRITE.length;
  const width = cols * PIXEL_SIZE;
  const height = rows * PIXEL_SIZE;

  let rects = "";
  for (let y = 0; y < rows; y++) {
    const row = STRUCT_SPRITE[y];
    for (let x = 0; x < row.length; x++) {
      const key = row[x];
      if (key === ".") continue;
      const fill = PIXEL_PALETTE[/** @type {keyof typeof PIXEL_PALETTE} */ (key)];
      if (!fill) continue;
      const cls =
        key === "y"
          ? ' class="sg-empty-struct-svg__pixel sg-empty-struct-svg__pixel--antenna"'
          : ' class="sg-empty-struct-svg__pixel"';
      rects += `<rect${cls} x="${x * PIXEL_SIZE}" y="${y * PIXEL_SIZE}" width="${PIXEL_SIZE}" height="${PIXEL_SIZE}" fill="${fill}" />`;
    }
  }

  return `<svg class="sg-empty-struct-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${rects}</svg>`;
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
