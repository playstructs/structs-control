/**
 * Illustrated empty state for DataTable rows — pixel-art service robot.
 */
export class TableEmptyState {
  /**
   * @param {{ title?: string, hint?: string, showIllustration?: boolean }} [props]
   * @returns {string}
   */
  static renderHTML(props = {}) {
    const { title = "No results.", hint, showIllustration = true } = props;
    const art = showIllustration
      ? `<div class="sg-datatable__empty-art" aria-hidden="true">${renderPixelRobotSprite()}</div>`
      : "";
    const hintHtml = hint ? `<p class="sg-datatable__empty-hint">${escapeHtml(hint)}</p>` : "";

    return `<div class="sg-datatable__empty" role="status">
      ${art}
      <p class="sg-datatable__empty-title">${escapeHtml(title)}</p>
      ${hintHtml}
    </div>`;
  }
}

/** Metallic chassis with Structs purple accents and LED details */
const PIXEL_PALETTE = Object.freeze({
  k: "#141820",
  K: "#232a36",
  s: "#3a4352",
  S: "#566273",
  n: "#7a8799",
  N: "#9aa8b8",
  w: "#c8d0da",
  W: "#edf1f6",
  p: "#4e3d9e",
  P: "#6b54d4",
  v: "#3ad4ec",
  l: "#32e070",
  y: "#f0b840",
  r: "#b87a42",
  a: "#455268",
});

/** Animated layers keyed by pixel char */
const PIXEL_GROUPS = Object.freeze({
  y: "sg-empty-robot__antenna",
  v: "sg-empty-robot__eyes",
  l: "sg-empty-robot__chest",
  a: "sg-empty-robot__arms",
});

/**
 * 32×32 humanoid service robot. Each char = one pixel.
 * Domed helmet, visor, neck joint, pauldrons, reactor chest,
 * segmented arms, pelvis, knees, and treaded feet.
 */
const ROBOT_SPRITE = [
  "................................",
  "...............yy...............",
  "..............ysy...............",
  ".............ysSy...............",
  "............ysSSSy..............",
  "...........ysSnSnSy.............",
  "..........ysSnnnnSSy............",
  ".........ysSSnvvvnSSy...........",
  ".........ysSwkvkkvwSy...........",
  "..........ysSnnnnnSy............",
  "...........ysSkkkSSy............",
  "............yskkkSy.............",
  "...........ysSSSSSy.............",
  ".........ysSSpSSpSSSy...........",
  "........ysSpSSSSSSSpSy..........",
  ".......ysSpSSllllSSpSy..........",
  ".......ysSpSSSSSSSSpSy..........",
  "......ysSpSy.......ySpSy........",
  "......ysSaSy.......ySaSy........",
  "......ysSaSy.......ySaSy........",
  "......yskSy.........ySkSy.......",
  "......ysSSy.........ySSSy.......",
  ".......ysSy.........ySSy........",
  "........ysSSSSSSSSSSy...........",
  ".......ysSSSSSSSSSSSy...........",
  ".......ysSk.........ySkS........",
  ".......ysSk.........ySkS........",
  ".......ysSr.........rSsy........",
  ".......ysSk.........ySkS........",
  "......ysSSk.........kSSSy.......",
  ".....ysSSSk.......kSSSSy........",
  "................................",
];

const PIXEL_SIZE = 4;

/** @returns {string} */
function renderPixelRobotSprite() {
  const cols = ROBOT_SPRITE[0].length;
  const rows = ROBOT_SPRITE.length;
  const width = cols * PIXEL_SIZE;
  const height = rows * PIXEL_SIZE;

  /** @type {Record<string, string>} */
  const groups = {
    "sg-empty-robot__base": "",
    "sg-empty-robot__antenna": "",
    "sg-empty-robot__eyes": "",
    "sg-empty-robot__chest": "",
    "sg-empty-robot__arms": "",
  };

  for (let y = 0; y < rows; y++) {
    const row = ROBOT_SPRITE[y];
    for (let x = 0; x < row.length; x++) {
      const key = row[x];
      if (key === ".") continue;
      const fill = PIXEL_PALETTE[/** @type {keyof typeof PIXEL_PALETTE} */ (key)];
      if (!fill) continue;
      const groupClass = PIXEL_GROUPS[key] ?? "sg-empty-robot__base";
      groups[groupClass] +=
        `<rect class="sg-empty-robot__pixel" x="${x * PIXEL_SIZE}" y="${y * PIXEL_SIZE}" width="${PIXEL_SIZE}" height="${PIXEL_SIZE}" fill="${fill}" />`;
    }
  }

  const groupMarkup = Object.entries(groups)
    .filter(([, rects]) => rects)
    .map(([cls, rects]) => `<g class="${cls}">${rects}</g>`)
    .join("");

  return `<svg class="sg-empty-robot-svg" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${groupMarkup}</svg>`;
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
