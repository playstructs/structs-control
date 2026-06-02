import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { floatingLabelField } from "../view_models/components/FloatingLabelField.js";
import { notify } from "../store/notify.js";
import { validateForm, required, maxLength, readFormValues } from "../util/validate.js";
import { keys } from "../store/keys.js";
import { formatGridAttributeOrDash, formatUnitOrZero } from "../util/unitDisplay.js";
import { formatCommissionPercent } from "../util/percentDisplay.js";
import { buildEntityLookup, entityLabel } from "../util/entityLookup.js";
import { renderEntityRef } from "../util/entityLink.js";

export class PlayerProfileController extends AbstractController {
  constructor(deps) {
    super("PlayerProfile", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.playerManager = deps.playerManager;
    this.infusionManager = deps.infusionManager;
  }

  activate(_page, params) {
    const id = params.id;
    if (!id) {
      this.router.goto("/players");
      return;
    }
    void this.playerManager.fetchPlayer(id);
    void this.playerManager.fetchAddresses(id);
    void this.infusionManager.fetchByPlayer(id);

    this.layout.mountContent(
      new PlayerProfileViewModel({
        store: this.store,
        router: this.router,
        playerId: id,
        playerManager: this.playerManager,
      }),
    );
  }
}

class PlayerProfileViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.playerId = deps.playerId;
    this.playerManager = deps.playerManager;
    this.editing = false;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.player(this.playerId));
    this.subscribe(this.store, keys.playerAddresses(this.playerId));
    this.subscribe(this.store, keys.playerInfusion(this.playerId));
  }

  render() {
    const player = this.store.read(keys.player(this.playerId));
    const addresses = this.store.read(keys.playerAddresses(this.playerId));
    const infusion = this.store.read(keys.playerInfusion(this.playerId));
    const lookup = buildEntityLookup(this.store, {
      players: player.status === "success" && player.data ? [player.data] : [],
    });

    return `
      ${LayoutViewModel.pageHeader({
        title: "Player",
        subtitle: entityLabel(this.playerId, lookup),
        actionsHtml: `<a class="btn btn-light btn-sm" href="/players" data-action="back"><i class="bi bi-chevron-left me-1"></i>Back to roster</a>`,
      })}
      ${ResourceView.render(player, {
        success: (p) => `
          <div class="row g-3">
            <div class="col-md-8">
              <form id="player-form" class="sg-card">
                <div class="sg-card__title d-flex justify-content-between align-items-center">
                  <span>Profile</span>
                  ${this.editing ? `<button class="btn btn-sm btn-primary" data-action="save">Save</button>` : `<button type="button" class="btn btn-sm btn-light" data-action="edit">Edit</button>`}
                </div>
                <div class="row g-3 mt-1">
                  <div class="col-md-6">${floatingLabelField({ id: "f-id", name: "id", label: "Player ID", value: p?.id, readonly: true })}</div>
                  <div class="col-md-6">${floatingLabelField({ id: "f-name", name: "name", label: "Name", value: p?.name ?? "", readonly: !this.editing })}</div>
                  <div class="col-md-12">${floatingLabelField({ id: "f-address", name: "primary_address", label: "Primary address", value: p?.primary_address ?? "", readonly: true })}</div>
                  <div class="col-md-6">${floatingLabelField({ id: "f-pfp", name: "pfp", label: "Avatar URL", value: p?.pfp ?? "", readonly: !this.editing })}</div>
                  <div class="col-md-6">${floatingLabelField({ id: "f-rank", name: "guild_rank", label: "Guild rank", value: String(p?.guild_rank ?? ""), readonly: true })}</div>
                </div>
              </form>
            </div>
            <div class="col-md-4">
              <div class="sg-card">
                <div class="sg-card__title">Avatar</div>
                ${p?.pfp ? `<img src="${escapeAttr(p.pfp)}" class="img-fluid rounded" onerror="this.style.display='none'" />` : `<div class="sg-empty"><div class="sg-empty__hint">No avatar set</div></div>`}
              </div>
              <div class="sg-card mt-3">
                <div class="sg-card__title">Power</div>
                <dl class="row mb-0">
                  ${dl("Capacity", formatGridAttributeOrDash("capacity", p?.capacity))}
                  ${dl("Load", formatGridAttributeOrDash("load", p?.load))}
                  ${dl("Ore", formatGridAttributeOrDash("ore", p?.ore))}
                  ${dl("Alpha", formatUnitOrZero(p?.alpha, "ualpha"))}
                </dl>
              </div>
            </div>
            <div class="col-md-12">
              <div class="sg-card">
                <div class="sg-card__title">Addresses</div>
                ${ResourceView.render(addresses, {
                  success: (list) =>
                    Array.isArray(list) && list.length
                      ? `<ul class="list-unstyled font-monospace small mb-0">${list.map((a) => `<li>${escapeHtml(a.address ?? a)}</li>`).join("")}</ul>`
                      : `<div class="sg-empty"><div class="sg-empty__hint">No addresses on file</div></div>`,
                })}
              </div>
            </div>
            <div class="col-md-12">
              <div class="sg-card">
                <div class="sg-card__title">Infusion</div>
                ${ResourceView.render(infusion, {
                  success: (i) =>
                    i
                      ? `<dl class="row mb-0">${dlHtml("Reactor", renderEntityRef(i.destination_id ?? i.reactor_id, lookup))}${dl("Fuel", formatGridAttributeOrDash("fuel", i.fuel))}${dl("Power", formatGridAttributeOrDash("power", i.power))}${dl("Commission", formatCommissionPercent(i.commission))}${dl("Defusing", i.defusing ? "Yes" : "No")}</dl>`
                      : `<div class="sg-empty"><div class="sg-empty__hint">Not infused</div></div>`,
                })}
              </div>
            </div>
          </div>
        `,
      })}
    `;
  }

  bind() {
    if (!this.container) return;
    this.container.querySelector('[data-action="back"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.router.goto("/players");
    });
    this.container.querySelector('[data-action="edit"]')?.addEventListener("click", () => {
      this.editing = true;
      this.update();
    });
    const form = /** @type {HTMLFormElement | null} */ (this.container.querySelector("#player-form"));
    form?.addEventListener("submit", (e) => e.preventDefault());
    this.container.querySelector('[data-action="save"]')?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!form) return;
      const values = readFormValues(form);
      const { valid, errors } = validateForm(
        { name: [required(), maxLength(64)], pfp: [maxLength(512)] },
        values,
      );
      if (!valid) {
        notify.formError("player-form", errors);
        return;
      }
      try {
        const nameChanged = values.name.trim() !== (this.store.read(keys.player(this.playerId)).data?.name ?? "");
        const pfpChanged = values.pfp.trim() !== (this.store.read(keys.player(this.playerId)).data?.pfp ?? "");
        if (nameChanged) {
          await this.playerManager.updateUsername(this.playerId, values.name.trim());
        }
        if (pfpChanged) {
          await this.playerManager.updatePfp(this.playerId, values.pfp.trim());
        }
        notify.toast("Profile updated", "success");
        this.editing = false;
        this.update();
      } catch (err) {
        notify.fromError(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}

function dl(label, value) {
  if (value == null || value === "" || value === "—") return "";
  return `<dt class="col-sm-4 text-secondary fw-normal small text-uppercase">${escapeHtml(label)}</dt><dd class="col-sm-8 mb-2">${escapeHtml(String(value))}</dd>`;
}

function dlHtml(label, html) {
  if (!html) return "";
  return `<dt class="col-sm-4 text-secondary fw-normal small text-uppercase">${escapeHtml(label)}</dt><dd class="col-sm-8 mb-2">${html}</dd>`;
}
function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
