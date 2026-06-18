import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { designSystemField, designSystemTextarea } from "../view_models/components/InputField.js";
import { editSaveBar, hideEditSaveBar, showEditSaveBar } from "../view_models/components/EditSaveBar.js";
import { overviewCardHeader } from "../view_models/components/OverviewCard.js";
import { MSG_TYPES } from "../constants/MessageTypes.js";
import { notify } from "../store/notify.js";
import { keys } from "../store/keys.js";
import {
  applyGuildDetailsForm,
  bypassLevelToInt,
  diffGuildForm,
  guildFormStatesEqual,
  guildToFormState,
  readGuildDetailsForm,
} from "../util/guildDetailsForm.js";

const BYPASS_OPTIONS = [
  { value: "closed", label: "Closed" },
  { value: "permissioned", label: "Permissioned" },
  { value: "member", label: "Member" },
];

/** Placeholder gallery thumbs until a logo API exists. */
const LOGO_GALLERY = [
  "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=170&h=228&fit=crop",
  "https://images.unsplash.com/photo-1464226184884-fa280b87eda0?w=170&h=228&fit=crop",
  "https://images.unsplash.com/photo-1501004318641-b39e6f593375?w=170&h=228&fit=crop",
  "https://images.unsplash.com/photo-1466692476866-aef1dfb1e735?w=170&h=228&fit=crop",
  "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=170&h=228&fit=crop",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=170&h=228&fit=crop",
];

/**
 * Guild Details — Figma Faction Details + bottom edit bar (1920:64585).
 * Edits enqueue chain transactions on Save; Cancel reverts the form.
 */
export class GuildDetailsController extends AbstractController {
  constructor(deps) {
    super("GuildDetails", deps.store);
    this.layout = deps.layout;
    this.guildManager = deps.guildManager;
  }

  activate() {
    const session = this.store.session?.data;
    if (!session) return;
    void this.guildManager.fetchGuild(session.guildId);
    this.layout.mountContent(new GuildDetailsViewModel({ store: this.store, guildId: session.guildId }));
  }
}

class GuildDetailsViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.guildId = deps.guildId;
    /** @type {import("../util/guildDetailsForm.js").GuildDetailsFormState | null} */
    this.baseline = null;
    this.dirty = false;
  }

  mount(container) {
    super.mount(container);
    this._unsubs.push(
      this.store.subscribe(keys.guild(this.guildId), () => {
        if (this.dirty) return;
        this.update();
      }),
    );
  }

  unmount() {
    hideEditSaveBar(document.getElementById("guild-edit-save-bar"));
    document.getElementById("guild-edit-save-bar")?.remove();
    super.unmount();
  }

  /** @param {import("../types/api.js").GuildData | null | undefined} guild */
  _syncBaseline(guild) {
    this.baseline = guildToFormState(guild);
    this.dirty = false;
  }

  render() {
    const guild = this.store.read(keys.guild(this.guildId));
    return ResourceView.render(guild, {
      success: (g) => {
        if (!this.dirty) this._syncBaseline(/** @type {import("../types/api.js").GuildData} */ (g));
        const s = guildToFormState(/** @type {import("../types/api.js").GuildData} */ (g));
        return `
          <div class="sg-guild-details">
            <form id="guild-details-form" class="sg-guild-details__layout" novalidate>
              <section class="sg-guild-details__card">
                ${overviewCardHeader({ title: "Faction Information", showMenu: true })}
                <div class="sg-guild-details__fields">
                  ${designSystemField({ id: "g-name", name: "name", label: "Faction Name", value: s.name })}
                  ${designSystemTextarea({
                    id: "g-description",
                    name: "description",
                    label: "Faction Description",
                    value: s.description,
                  })}
                  ${designSystemField({
                    id: "g-entry-sub",
                    name: "entry_substation_id",
                    label: "Entry Substation ID",
                    value: s.entry_substation_id,
                  })}
                  ${designSystemField({
                    id: "g-infusion-min",
                    name: "join_infusion_minimum",
                    label: "Join Infusion Minimum",
                    value: s.join_infusion_minimum,
                  })}
                  <div class="sg-guild-details__permissions">
                    <h3 class="sg-guild-details__permissions-title">Infusion Bypass Permissions</h3>
                    <p class="sg-guild-details__permissions-copy">
                      Set permissions to determine who can approve membership requests/invites for players who do not
                      meet the <strong>Join Infusion Minimum</strong>, or disallow such bypasses completely.
                    </p>
                    ${renderBypassRow("Allow Join Requests", "bypass_by_request", s.bypass_by_request)}
                    ${renderBypassRow("Allow Invites", "bypass_by_invite", s.bypass_by_invite)}
                  </div>
                  <div class="sg-guild-details__logo-block">
                    <div class="sg-guild-details__logo-head">
                      <h3 class="sg-guild-details__section-title">Logo Selection</h3>
                    </div>
                    <img
                      class="sg-guild-details__logo-preview"
                      data-role="logo-preview"
                      src="${escapeAttr(s.logo)}"
                      alt=""
                      ${s.logo ? "" : "hidden"}
                    />
                    <input type="hidden" name="logo" value="${escapeAttr(s.logo)}" data-role="logo-input" />
                    <button type="button" class="sg-btn-lunar" data-action="change-logo">Change</button>
                  </div>
                  <div>
                    <h3 class="sg-guild-details__social-title">Social Links</h3>
                    ${designSystemField({ id: "g-social-fb", name: "social_facebook", label: "Facebook", value: s.social_facebook })}
                    ${designSystemField({ id: "g-social-discord", name: "social_discord", label: "Discord", value: s.social_discord })}
                    ${designSystemField({ id: "g-social-x", name: "social_x", label: "X account", value: s.social_x })}
                    ${designSystemField({
                      id: "g-social-ig",
                      name: "social_instagram",
                      label: "Instagram",
                      value: s.social_instagram,
                    })}
                  </div>
                </div>
              </section>
              <aside class="sg-guild-details__library" aria-label="Image library">
                ${overviewCardHeader({ title: "Image Library", showMenu: false })}
                <div class="sg-guild-details__library-grid">
                  ${LOGO_GALLERY.map(
                    (url, i) =>
                      `<button type="button" class="sg-guild-details__library-thumb${url === s.logo ? " is-selected" : ""}" data-action="pick-logo" data-logo-url="${escapeAttr(url)}" aria-label="Select logo ${i + 1}"><img src="${escapeAttr(url)}" alt="" /></button>`,
                  ).join("")}
                </div>
              </aside>
            </form>
          </div>
          ${editSaveBar({ id: "guild-edit-save-bar" })}
        `;
      },
    });
  }

  bind() {
    if (!this.container) return;
    const form = /** @type {HTMLFormElement | null} */ (this.container.querySelector("#guild-details-form"));
    if (!form) return;

    const guild = this.store.read(keys.guild(this.guildId));
    if (!this.baseline && guild.status === "success" && guild.data) {
      this._syncBaseline(/** @type {import("../types/api.js").GuildData} */ (guild.data));
    }
    if (!this.baseline) return;

    let bar = /** @type {HTMLElement | null} */ (
      this.container.querySelector("#guild-edit-save-bar") ?? document.getElementById("guild-edit-save-bar")
    );
    document.querySelectorAll("#guild-edit-save-bar").forEach((node) => {
      if (node !== bar) node.remove();
    });
    if (bar && bar.parentElement !== document.body) {
      document.body.appendChild(bar);
    }
    if (!this.dirty) hideEditSaveBar(bar);

    const logoInput = /** @type {HTMLInputElement | null} */ (form.querySelector('[data-role="logo-input"]'));
    const logoPreview = /** @type {HTMLImageElement | null} */ (form.querySelector('[data-role="logo-preview"]'));

    const syncDirty = () => {
      const current = readGuildDetailsForm(form);
      this.dirty = !guildFormStatesEqual(this.baseline, current);
      if (this.dirty) showEditSaveBar(bar);
      else hideEditSaveBar(bar);
    };

    form.addEventListener("input", syncDirty);
    form.addEventListener("change", syncDirty);

    form.querySelector('[data-action="change-logo"]')?.addEventListener("click", () => {
      const next = window.prompt("Logo image URL", logoInput?.value ?? "");
      if (next == null) return;
      if (logoInput) logoInput.value = next;
      if (logoPreview) {
        logoPreview.src = next;
        logoPreview.hidden = !next;
      }
      form.querySelectorAll("[data-action='pick-logo']").forEach((btn) => {
        btn.classList.toggle("is-selected", btn.getAttribute("data-logo-url") === next);
      });
      syncDirty();
    });

    form.querySelectorAll('[data-action="pick-logo"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-logo-url") ?? "";
        if (logoInput) logoInput.value = url;
        if (logoPreview) {
          logoPreview.src = url;
          logoPreview.hidden = !url;
        }
        form.querySelectorAll("[data-action='pick-logo']").forEach((other) => {
          other.classList.toggle("is-selected", other === btn);
        });
        syncDirty();
      });
    });

    bar?.querySelector('[data-role="edit-cancel"]')?.addEventListener("click", () => {
      applyGuildDetailsForm(form, /** @type {import("../util/guildDetailsForm.js").GuildDetailsFormState} */ (this.baseline));
      form.querySelectorAll("[data-action='pick-logo']").forEach((btn) => {
        btn.classList.toggle("is-selected", btn.getAttribute("data-logo-url") === this.baseline?.logo);
      });
      this.dirty = false;
      hideEditSaveBar(bar);
    });

    bar?.querySelector('[data-role="edit-save"]')?.addEventListener("click", () => {
      this._save(form, bar);
    });
  }

  /** @param {HTMLFormElement} form @param {HTMLElement | null} bar */
  _save(form, bar) {
    if (!this.baseline) return;
    const current = readGuildDetailsForm(form);
    const changed = diffGuildForm(this.baseline, current);
    const enqueue = (typeUrl, value, label) => {
      this.store.tx?.enqueue(
        { typeUrl, value: { creator: "", guild_id: this.guildId, ...value } },
        { invalidate: [keys.guild(this.guildId)] },
      );
      notify.toast(`${label} enqueued`, "info");
    };

    let txCount = 0;
    const metaFields = [];

    if ("name" in changed) {
      enqueue(MSG_TYPES.GUILD_UPDATE_NAME, { name: changed.name }, "Name update");
      txCount++;
    }
    if ("logo" in changed) {
      enqueue(MSG_TYPES.GUILD_UPDATE_PFP, { pfp: changed.logo }, "Logo update");
      txCount++;
    }
    if ("entry_substation_id" in changed) {
      enqueue(
        MSG_TYPES.GUILD_UPDATE_ENTRY_SUBSTATION_ID,
        { entry_substation_id: changed.entry_substation_id },
        "Entry substation",
      );
      txCount++;
    }
    if ("join_infusion_minimum" in changed) {
      enqueue(
        MSG_TYPES.GUILD_UPDATE_JOIN_INFUSION_MINIMUM,
        { join_infusion_minimum: changed.join_infusion_minimum },
        "Join infusion minimum",
      );
      txCount++;
    }
    if ("bypass_by_request" in changed) {
      enqueue(
        MSG_TYPES.GUILD_UPDATE_JOIN_INFUSION_MINIMUM_BYPASS_BY_REQUEST,
        { guild_join_bypass_level: bypassLevelToInt(changed.bypass_by_request ?? "closed") },
        "Join request bypass",
      );
      txCount++;
    }
    if ("bypass_by_invite" in changed) {
      enqueue(
        MSG_TYPES.GUILD_UPDATE_JOIN_INFUSION_MINIMUM_BYPASS_BY_INVITE,
        { guild_join_bypass_level: bypassLevelToInt(changed.bypass_by_invite ?? "closed") },
        "Invite bypass",
      );
      txCount++;
    }

    if ("description" in changed) metaFields.push("description");
    if ("social_facebook" in changed || "social_discord" in changed || "social_x" in changed || "social_instagram" in changed) {
      metaFields.push("social links");
    }

    if (txCount === 0 && metaFields.length === 0) {
      notify.toast("No changes to save", "info");
      return;
    }

    if (metaFields.length) {
      notify.toast(`${metaFields.join(" and ")} cannot be saved yet — no chain message available`, "warning");
    }

    if (txCount > 0) {
      this.baseline = { ...current };
      this.dirty = false;
      hideEditSaveBar(bar);
      notify.toast(txCount === 1 ? "Change submitted" : `${txCount} changes submitted`, "success");
    }
  }
}

/** @param {string} label @param {string} name @param {string} value */
function renderBypassRow(label, name, value) {
  return `
    <div class="sg-guild-details__permission-row">
      <p class="sg-guild-details__permission-label">${escapeHtml(label)}</p>
      <select class="sg-guild-details__select" name="${escapeAttr(name)}" aria-label="${escapeAttr(label)}">
        ${BYPASS_OPTIONS.map(
          (opt) =>
            `<option value="${escapeAttr(opt.value)}"${opt.value === value ? " selected" : ""}>${escapeHtml(opt.label)}</option>`,
        ).join("")}
      </select>
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

function escapeAttr(s) {
  return escapeHtml(s);
}
