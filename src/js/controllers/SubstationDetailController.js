import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { statCard } from "../view_models/components/StatCard.js";
import { tableShell } from "../view_models/components/TableShell.js";
import { notify } from "../store/notify.js";
import { readFormValues, validateForm, required, pattern } from "../util/validate.js";
import { keys } from "../store/keys.js";
import {
  allocationControllerId,
  allocationDestinationId,
  allocationId,
  allocationTypeLabel,
} from "../util/allocationDisplay.js";

export class SubstationDetailController extends AbstractController {
  constructor(deps) {
    super("SubstationDetail", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.substationManager = deps.substationManager;
    this.allocationManager = deps.allocationManager;
  }

  activate(_page, params) {
    const id = params.id;
    if (!id) {
      this.router.goto("/energy/substations");
      return;
    }
    void this.substationManager.fetchSubstation(id);
    void this.substationManager.fetchPlayers(id);
    void this.allocationManager.fetchBySource(id);
    this.layout.mountContent(
      new SubstationDetailViewModel({
        store: this.store,
        router: this.router,
        id,
        allocationManager: this.allocationManager,
      }),
    );
  }
}

class SubstationDetailViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.id = deps.id;
    this.allocationManager = deps.allocationManager;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.substation(this.id));
    this.subscribe(this.store, keys.substationPlayers(this.id));
    this.subscribe(this.store, keys.allocationBySource(this.id));
  }

  render() {
    const sub = this.store.read(keys.substation(this.id));
    const players = this.store.read(keys.substationPlayers(this.id));
    const allocs = this.store.read(keys.allocationBySource(this.id));
    const defaultController = this.store.session?.data?.playerId ?? "";

    return `
      ${LayoutViewModel.pageHeader({
        title: "Substation",
        subtitle: this.id,
        actionsHtml: `<a class="btn btn-light btn-sm" href="/energy/substations" data-action="back"><i class="bi bi-chevron-left me-1"></i>Back</a>`,
      })}
      ${ResourceView.render(sub, {
        success: (s) => `
          <div class="sg-stat-grid">
            ${statCard({ label: "Name", value: s?.name ?? "—" })}
            ${statCard({ label: "Owner", value: s?.owner ?? "—" })}
            ${statCard({ label: "Creator", value: s?.creator ?? "—" })}
          </div>
        `,
      })}
      <div class="row g-3">
        <div class="col-md-6">
          <div class="sg-card">
            <div class="sg-card__title">Connected players</div>
            ${ResourceView.render(players, {
              success: (rows) =>
                Array.isArray(rows) && rows.length
                  ? `<ul class="list-unstyled mb-0">${rows
                      .map(
                        (p) =>
                          `<li class="d-flex justify-content-between border-bottom py-2"><a href="/players/${escapeAttr(p.id)}" data-action="goto" data-path="/players/${escapeAttr(p.id)}" class="font-monospace small">${escapeHtml(p.id)}</a><span class="text-secondary">${escapeHtml(p.guild_id ?? "")}</span></li>`,
                      )
                      .join("")}</ul>`
                  : `<div class="sg-empty"><div class="sg-empty__hint">No players connected.</div></div>`,
            })}
          </div>
        </div>
        <div class="col-md-6">
          <div class="sg-card">
            <div class="sg-card__title">Outbound allocations</div>
            ${ResourceView.render(allocs, {
              success: (rows) =>
                Array.isArray(rows) && rows.length
                  ? tableShell({
                      embedded: true,
                      tableHtml: `<thead><tr><th>ID</th><th>Type</th><th>Destination</th><th>Controller</th><th></th></tr></thead><tbody>${rows
                        .map(
                          (a) =>
                            `<tr>
                              <td class="sg-datatable__cell-mono">${escapeHtml(allocationId(a))}</td>
                              <td>${escapeHtml(allocationTypeLabel(a))}</td>
                              <td class="sg-datatable__cell-mono">${escapeHtml(allocationDestinationId(a))}</td>
                              <td class="sg-datatable__cell-mono">${escapeHtml(allocationControllerId(a))}</td>
                              <td class="text-end">
                                <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete-alloc" data-id="${escapeAttr(allocationId(a))}">Delete</button>
                              </td>
                            </tr>`,
                        )
                        .join("")}</tbody>`,
                    })
                  : `<div class="sg-empty"><div class="sg-empty__hint">No outbound allocations.</div></div>`,
            })}
          </div>
        </div>
      </div>
      <div class="sg-card mt-3">
        <div class="sg-card__title">Create allocation</div>
        <form id="form-alloc-create" class="row g-3">
          <div class="col-md-3">
            <label class="form-label small text-secondary" for="alloc-source">Source</label>
            <input id="alloc-source" name="source_object_id" type="text" class="form-control font-monospace" value="${escapeAttr(this.id)}" readonly />
          </div>
          <div class="col-md-3">
            <label class="form-label small text-secondary" for="alloc-controller">Controller (player ID)</label>
            <input id="alloc-controller" name="controller" type="text" class="form-control font-monospace" value="${escapeAttr(defaultController)}" />
            <div class="invalid-feedback"></div>
          </div>
          <div class="col-md-3">
            <label class="form-label small text-secondary" for="alloc-type">Type</label>
            <select id="alloc-type" name="allocation_type" class="form-select">
              <option value="static">static</option>
              <option value="dynamic">dynamic</option>
              <option value="automated" selected>automated</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label small text-secondary" for="alloc-power">Power</label>
            <input id="alloc-power" name="power" type="text" class="form-control" placeholder="0" />
            <div class="invalid-feedback"></div>
          </div>
          <div class="col-md-1 d-flex align-items-end">
            <button type="button" class="btn btn-primary w-100" data-action="create-alloc">Create</button>
          </div>
        </form>
      </div>
    `;
  }

  bind() {
    if (!this.container) return;
    this.container.querySelector('[data-action="back"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.router.goto("/energy/substations");
    });
    this.container.querySelectorAll('[data-action="goto"]').forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const path = /** @type {HTMLElement} */ (a).dataset.path;
        if (path) this.router.goto(path);
      }),
    );

    const createSchema = {
      controller: [required()],
      power: [required(), pattern(/^\d+$/, "Whole numbers only")],
    };

    this.container.querySelector('[data-action="create-alloc"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const container = this.container;
      if (!container) return;
      const form = /** @type {HTMLFormElement | null} */ (container.querySelector("#form-alloc-create"));
      if (!form) return;
      const v = readFormValues(form);
      const { valid, errors } = validateForm(createSchema, v);
      if (!valid) return notify.formError("form-alloc-create", errors);
      void this.allocationManager.enqueueCreate({
        sourceObjectId: v.source_object_id || this.id,
        controller: v.controller,
        allocationType: v.allocation_type,
        power: v.power,
      });
      notify.toast("Allocation create enqueued", "info");
    });

    this.container.querySelectorAll('[data-action="delete-alloc"]').forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = /** @type {HTMLElement} */ (btn).dataset.id;
        if (!id || !window.confirm(`Delete allocation ${id}?`)) return;
        void this.allocationManager.enqueueDelete({ allocationId: id, sourceId: this.id });
        notify.toast("Delete enqueued", "info");
      }),
    );
  }
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
