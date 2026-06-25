/** @typedef {import("../types/api.js").GuildData} GuildData */

/** @typedef {{
 *   name: string,
 *   description: string,
 *   entry_substation_id: string,
 *   join_infusion_minimum: string,
 *   bypass_by_request: string,
 *   bypass_by_invite: string,
 *   logo: string,
 *   social_facebook: string,
 *   social_discord: string,
 *   social_x: string,
 *   social_instagram: string,
 * }} GuildDetailsFormState */

/** @param {unknown} value @returns {string} */
function bypassLabel(value) {
  const n = Number(value);
  if (n === 1 || value === "permissioned") return "permissioned";
  if (n === 2 || value === "member") return "member";
  return "closed";
}

/** @param {Record<string, unknown> | null | undefined} socials */
function readSocial(socials, key) {
  if (!socials || typeof socials !== "object") return "";
  const v = /** @type {Record<string, unknown>} */ (socials)[key];
  return v == null ? "" : String(v);
}

/**
 * @param {GuildData | null | undefined} guild
 * @returns {GuildDetailsFormState}
 */
export function guildToFormState(guild) {
  const socials =
    guild?.socials && typeof guild.socials === "object"
      ? /** @type {Record<string, unknown>} */ (guild.socials)
      : typeof guild?.socials === "string"
        ? safeJsonParse(guild.socials)
        : {};
  return {
    name: guild?.name ?? "",
    description: guild?.description ?? "",
    entry_substation_id: guild?.entry_substation_id ?? "",
    join_infusion_minimum: guild?.join_infusion_minimum != null ? String(guild.join_infusion_minimum) : "",
    bypass_by_request: bypassLabel(guild?.join_infusion_minimum_bypass_by_request),
    bypass_by_invite: bypassLabel(guild?.join_infusion_minimum_bypass_by_invite),
    logo: guild?.logo ?? guild?.pfp ?? "",
    social_facebook: readSocial(socials, "facebook"),
    social_discord: readSocial(socials, "discord"),
    social_x: readSocial(socials, "twitter") || readSocial(socials, "x"),
    social_instagram: readSocial(socials, "instagram"),
  };
}

/** @param {HTMLFormElement | null | undefined} form @returns {GuildDetailsFormState} */
export function readGuildDetailsForm(form) {
  if (!form) {
    return guildToFormState(null);
  }
  const fd = new FormData(form);
  return {
    name: String(fd.get("name") ?? ""),
    description: String(fd.get("description") ?? ""),
    entry_substation_id: String(fd.get("entry_substation_id") ?? ""),
    join_infusion_minimum: String(fd.get("join_infusion_minimum") ?? ""),
    bypass_by_request: String(fd.get("bypass_by_request") ?? "closed"),
    bypass_by_invite: String(fd.get("bypass_by_invite") ?? "closed"),
    logo: String(fd.get("logo") ?? ""),
    social_facebook: String(fd.get("social_facebook") ?? ""),
    social_discord: String(fd.get("social_discord") ?? ""),
    social_x: String(fd.get("social_x") ?? ""),
    social_instagram: String(fd.get("social_instagram") ?? ""),
  };
}

/**
 * @param {HTMLFormElement} form
 * @param {GuildDetailsFormState} state
 */
export function applyGuildDetailsForm(form, state) {
  for (const [name, value] of Object.entries(state)) {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      el.value = value;
    }
  }
  const preview = form.querySelector("[data-role='logo-preview']");
  if (preview instanceof HTMLImageElement) {
    preview.src = state.logo || "";
    preview.hidden = !state.logo;
  }
}

/**
 * @param {GuildDetailsFormState} a
 * @param {GuildDetailsFormState} b
 * @returns {boolean}
 */
export function guildFormStatesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** @param {string} level @returns {number} */
export function bypassLevelToInt(level) {
  if (level === "permissioned") return 1;
  if (level === "member") return 2;
  return 0;
}

/** @param {GuildDetailsFormState} baseline @param {GuildDetailsFormState} current */
export function diffGuildForm(baseline, current) {
  /** @type {Partial<GuildDetailsFormState>} */
  const changed = {};
  for (const key of /** @type {(keyof GuildDetailsFormState)[]} */ (Object.keys(baseline))) {
    if (baseline[key] !== current[key]) changed[key] = current[key];
  }
  return changed;
}

/** @param {string} raw */
function safeJsonParse(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? /** @type {Record<string, unknown>} */ (parsed) : {};
  } catch {
    return {};
  }
}
