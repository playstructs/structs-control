import { coalesceNumeric, unitLegacyFormat } from "./unitDisplay.js";

/**
 * @param {unknown} load
 * @param {unknown} capacity
 * @returns {number | null}
 */
export function capacityPercent(load, capacity) {
  const cap = coalesceNumeric(capacity, 0);
  const ld = coalesceNumeric(load, 0);
  if (cap <= 0) return null;
  return Math.round((ld / cap) * 100);
}

/**
 * @param {unknown} load
 * @param {unknown} playerCount
 * @returns {number}
 */
export function perPlayerDraw(load, playerCount) {
  const count = Math.max(1, coalesceNumeric(playerCount, 0));
  return coalesceNumeric(load, 0) / count;
}

/**
 * @param {number} next
 * @param {number} prev
 * @returns {number | null}
 */
export function percentChange(next, prev) {
  if (!Number.isFinite(prev) || prev === 0) return null;
  return Math.round(((next - prev) / prev) * 100);
}

/**
 * @param {unknown} load
 * @param {unknown} capacity
 * @returns {"success" | "warning" | "danger"}
 */
export function capacityTone(load, capacity) {
  const pct = capacityPercent(load, capacity);
  if (pct == null) return "warning";
  if (pct >= 90) return "danger";
  if (pct >= 70) return "warning";
  return "success";
}

/**
 * @param {unknown} load
 * @param {unknown} capacity
 * @returns {string}
 */
export function capacityBarHtml(load, capacity) {
  const pct = capacityPercent(load, capacity) ?? 0;
  const tone = capacityTone(load, capacity);
  const width = Math.min(100, Math.max(0, pct));
  const legacyLoad = unitLegacyFormat(load, "milliwatt");
  const legacyCap = unitLegacyFormat(capacity, "milliwatt");
  const label = legacyLoad != null && legacyCap != null ? `${legacyLoad}/${legacyCap}` : `${pct}%`;
  return `<span class="sg-capacity-bar sg-capacity-bar--${tone}" title="${escapeAttr(label)}">
    <span class="sg-capacity-bar__track"><span class="sg-capacity-bar__fill" style="width:${width}%"></span></span>
    <span class="sg-capacity-bar__label">${escapeHtml(label)}</span>
  </span>`;
}

/**
 * @param {unknown} value milliwatts
 * @returns {string}
 */
export function formatKw(value) {
  const kw = unitLegacyFormat(value, "milliwatt");
  if (kw == null) return "—";
  return `${kw} Kw`;
}

/**
 * @param {number | null} pct
 * @returns {string}
 */
export function formatPercentChange(pct) {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  const tone = pct < 0 ? "down" : pct > 0 ? "up" : "flat";
  return `<span class="sg-pct-change sg-pct-change--${tone}">${sign}${pct}%</span>`;
}

/**
 * @param {import("../types/api.js").SubstationData} row
 * @param {import("../managers/GridManager.js").GridManager} gridManager
 */
export function substationGridAttrs(row, gridManager) {
  const grid = gridManager.getForObject(row.id);
  return {
    capacity: grid.capacity ?? row.capacity,
    load: grid.load ?? row.load,
    powerIn: row.energy_in ?? grid.power,
    powerOut: row.energy_out,
  };
}

/**
 * @param {import("../types/api.js").SubstationData[]} substations
 * @param {import("../managers/GridManager.js").GridManager} gridManager
 */
export function computeEnergyGridActivityCards(substations, gridManager) {
  const list = Array.isArray(substations) ? substations : [];
  if (!list.length) {
    return [
      { icon: "bi-arrow-up-square-fill", iconTone: "success", label: "Most Connections", name: "—", metric: "—" },
      {
        icon: "bi-arrow-down-square-fill",
        iconTone: "danger",
        label: "Biggest Drop (last 24hr)",
        name: "—",
        metric: "—",
      },
      { icon: "bi-lightning-charge-fill", iconTone: "warning", label: "Most Power Input", name: "—", metric: "—" },
    ];
  }

  const byPlayers = [...list].sort((a, b) => (b.player_count ?? 0) - (a.player_count ?? 0))[0];
  const byPowerIn = [...list].sort((a, b) => {
    const aIn = coalesceNumeric(a.energy_in ?? gridManager.getForObject(a.id).power, 0);
    const bIn = coalesceNumeric(b.energy_in ?? gridManager.getForObject(b.id).power, 0);
    return bIn - aIn;
  })[0];
  const byLoad = [...list].sort((a, b) => {
    const aLoad = coalesceNumeric(gridManager.getForObject(a.id).load ?? a.load, 0);
    const bLoad = coalesceNumeric(gridManager.getForObject(b.id).load ?? b.load, 0);
    return bLoad - aLoad;
  })[0];

  return [
    {
      icon: "bi-arrow-up-square-fill",
      iconTone: "success",
      label: "Most Connections",
      name: byPlayers?.name ?? byPlayers?.id ?? "—",
      metric: `${byPlayers?.player_count ?? 0} connections`,
    },
    {
      icon: "bi-arrow-down-square-fill",
      iconTone: "danger",
      label: "Biggest Drop (last 24hr)",
      name: byLoad?.name ?? byLoad?.id ?? "—",
      metric: formatKw(gridManager.getForObject(byLoad?.id ?? "").load ?? byLoad?.load),
    },
    {
      icon: "bi-lightning-charge-fill",
      iconTone: "warning",
      label: "Most Power Input",
      name: byPowerIn?.name ?? byPowerIn?.id ?? "—",
      metric: formatKw(byPowerIn?.energy_in ?? gridManager.getForObject(byPowerIn?.id ?? "").power),
    },
  ];
}

/**
 * @param {string} idsParam comma-separated player ids
 * @returns {string[]}
 */
export function parsePlayerIdsParam(idsParam) {
  if (!idsParam) return [];
  return String(idsParam)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string[]} ids
 * @returns {string}
 */
export function serializePlayerIdsParam(ids) {
  return ids.filter(Boolean).join(",");
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
