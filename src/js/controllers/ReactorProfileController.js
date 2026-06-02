import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { statCard } from "../view_models/components/StatCard.js";
import { tableShell } from "../view_models/components/TableShell.js";
import { notify } from "../store/notify.js";
import { statusBadge } from "../util/statusDisplay.js";
import { readFormValues, validateForm, required, pattern } from "../util/validate.js";
import { keys } from "../store/keys.js";

export class ReactorProfileController extends AbstractController {
  constructor(deps) {
    super("ReactorProfile", deps.store);
    this.layout = deps.layout;
    this.router = deps.router;
    this.infusionManager = deps.infusionManager;
    this.reactorManager = deps.reactorManager;
  }

  activate(_page, params) {
    const id = params.id;
    if (!id) {
      this.router.goto("/energy/reactors");
      return;
    }
    void this.reactorManager.fetchReactor(id);
    void this.infusionManager.fetchByReactor(id);
    this.layout.mountContent(
      new ReactorProfileViewModel({
        store: this.store,
        router: this.router,
        id,
        reactorManager: this.reactorManager,
      }),
    );
  }
}

class ReactorProfileViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.router = deps.router;
    this.id = deps.id;
    this.reactorManager = deps.reactorManager;
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.reactor(this.id));
    this.subscribe(this.store, keys.reactorInfusion(this.id));
  }

  render() {
    const reactor = this.store.read(keys.reactor(this.id));
    const infusion = this.store.read(keys.reactorInfusion(this.id));
    const sessionAddress = this.store.session?.data?.address ?? "";

    return `
      ${LayoutViewModel.pageHeader({
        title: "Reactor",
        subtitle: this.id,
        actionsHtml: `<a class="btn btn-light btn-sm" href="/energy/reactors" data-action="back"><i class="bi bi-chevron-left me-1"></i>Back</a>`,
      })}
      ${ResourceView.render(reactor, {
        success: (r) => `
          <div class="sg-stat-grid">
            ${statCard({ label: "Owner", value: r?.owner ?? "—" })}
            ${statCard({ label: "Guild", value: r?.guild_id ?? "—" })}
            ${statCard({ label: "Validator", value: r?.validator ?? "—" })}
            ${statCard({ label: "Commission", value: r?.default_commission ?? "—" })}
          </div>
        `,
      })}
      <div class="row g-3 mb-3">
        <div class="col-md-6">
          <form id="form-infuse" class="sg-card">
            <div class="sg-card__title">Infuse alpha</div>
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label small text-secondary" for="infuse-delegator">Delegator address</label>
                <input id="infuse-delegator" name="delegator_address" type="text" class="form-control font-monospace small" value="${escapeAttr(sessionAddress)}" />
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-md-6">
                <label class="form-label small text-secondary" for="infuse-amount">Amount (alpha)</label>
                <input id="infuse-amount" name="amount_alpha" type="text" class="form-control" placeholder="0" />
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-md-6 d-flex align-items-end">
                <button type="button" class="btn btn-primary w-100" data-action="infuse">Infuse</button>
              </div>
            </div>
          </form>
        </div>
        <div class="col-md-6">
          <form id="form-defuse" class="sg-card">
            <div class="sg-card__title">Defuse alpha</div>
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label small text-secondary" for="defuse-delegator">Delegator address</label>
                <input id="defuse-delegator" name="delegator_address" type="text" class="form-control font-monospace small" value="${escapeAttr(sessionAddress)}" />
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-md-6">
                <label class="form-label small text-secondary" for="defuse-amount">Amount (alpha)</label>
                <input id="defuse-amount" name="amount_alpha" type="text" class="form-control" placeholder="0" />
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-md-6 d-flex align-items-end">
                <button type="button" class="btn btn-outline-danger w-100" data-action="defuse">Defuse</button>
              </div>
            </div>
          </form>
        </div>
      </div>
      <div class="sg-card">
        <div class="sg-card__title">Infusions at this reactor</div>
        ${ResourceView.render(infusion, {
          success: (rows) => {
            const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
            if (!list.length) {
              return `<div class="sg-empty"><div class="sg-empty__hint">No player infusions at this reactor.</div></div>`;
            }
            return tableShell({
              embedded: true,
              tableHtml: `<thead><tr><th>Player</th><th>Address</th><th>Fuel</th><th>Power</th><th>Defusing</th></tr></thead><tbody>${list
                .map(
                  (i) =>
                    `<tr>
                      <td class="sg-datatable__cell-mono">${escapeHtml(i.player_id ?? "—")}</td>
                      <td class="sg-datatable__cell-mono">${escapeHtml(i.address ?? "—")}</td>
                      <td>${escapeHtml(i.fuel ?? "—")}</td>
                      <td>${escapeHtml(i.power ?? "—")}</td>
                      <td>${statusBadge(i.defusing ? "Pending" : "Online")}</td>
                    </tr>`,
                )
                .join("")}</tbody>`,
            });
          },
        })}
      </div>
    `;
  }

  bind() {
    if (!this.container) return;
    this.container.querySelector('[data-action="back"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.router.goto("/energy/reactors");
    });

    const amountSchema = {
      delegator_address: [required()],
      amount_alpha: [required(), pattern(/^\d+$/, "Whole numbers only")],
    };

    const validatorFromReactor = () => {
      const r = this.store.read(keys.reactor(this.id));
      return r?.status === "success" ? r.data?.validator : null;
    };

    this.container.querySelector('[data-action="infuse"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const container = this.container;
      if (!container) return;
      const form = /** @type {HTMLFormElement | null} */ (container.querySelector("#form-infuse"));
      if (!form) return;
      const v = readFormValues(form);
      const { valid, errors } = validateForm(amountSchema, v);
      if (!valid) return notify.formError("form-infuse", errors);
      const validator = validatorFromReactor();
      if (!validator) return notify.toast("Reactor validator not loaded", "danger");
      void this.reactorManager.enqueueInfuse({
        validatorAddress: String(validator),
        delegatorAddress: v.delegator_address,
        amountAlpha: v.amount_alpha,
        reactorId: this.id,
      });
      notify.toast("Infuse enqueued", "info");
    });

    this.container.querySelector('[data-action="defuse"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const container = this.container;
      if (!container) return;
      const form = /** @type {HTMLFormElement | null} */ (container.querySelector("#form-defuse"));
      if (!form) return;
      const v = readFormValues(form);
      const { valid, errors } = validateForm(amountSchema, v);
      if (!valid) return notify.formError("form-defuse", errors);
      const validator = validatorFromReactor();
      if (!validator) return notify.toast("Reactor validator not loaded", "danger");
      void this.reactorManager.enqueueDefuse({
        validatorAddress: String(validator),
        delegatorAddress: v.delegator_address,
        amountAlpha: v.amount_alpha,
        reactorId: this.id,
      });
      notify.toast("Defuse enqueued", "info");
    });
  }
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
