import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { notify } from "../store/notify.js";
import { readFormValues, validateForm, required, pattern } from "../util/validate.js";

/**
 * Guild Banks page + Mint/Redeem sub-page. The Guild API doesn't (yet) expose
 * bank balance reads in our reference, so this page is mostly action-form;
 * balances will be added when the endpoint exists -- see
 * docs/guild-api-requirements.md.
 */
export class BankController extends AbstractController {
  constructor(deps) {
    super("Bank", deps.store);
    this.layout = deps.layout;
    this.bankManager = deps.bankManager;
  }

  activate(page) {
    const session = this.store.session?.data;
    if (!session) return;
    if (page === "mintRedeem") {
      this.layout.mountContent(new MintRedeemViewModel({ store: this.store, bankManager: this.bankManager, guildId: session.guildId }));
    } else {
      this.layout.mountContent(new GuildBanksViewModel({ store: this.store, guildId: session.guildId }));
    }
  }
}

class GuildBanksViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.guildId = deps.guildId;
  }

  render() {
    return `
      ${LayoutViewModel.pageHeader({ title: "Guild banks", subtitle: "Tokens minted by the guild treasury." })}
      <div class="sg-empty">
        <div class="sg-empty__title">No bank data endpoint</div>
        <div class="sg-empty__hint">The Guild API doesn't currently expose bank-balance reads. Logged to docs/guild-api-requirements.md.</div>
      </div>
    `;
  }
}

class MintRedeemViewModel extends AbstractViewModel {
  constructor(deps) {
    super();
    this.store = deps.store;
    this.bankManager = deps.bankManager;
    this.guildId = deps.guildId;
  }

  render() {
    return `
      ${LayoutViewModel.pageHeader({ title: "Mint / Redeem", subtitle: "Submit guild bank transactions." })}
      <div class="row g-3">
        <div class="col-md-6">
          <form id="form-mint" class="sg-card">
            <div class="sg-card__title">Mint</div>
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label small text-secondary" for="mint-alpha">Amount alpha</label>
                <input id="mint-alpha" name="amount_alpha" type="text" class="form-control" placeholder="0" />
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-md-6">
                <label class="form-label small text-secondary" for="mint-token">Amount token</label>
                <input id="mint-token" name="amount_token" type="text" class="form-control" placeholder="0" />
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-12"><button class="btn btn-primary" data-action="mint">Mint</button></div>
            </div>
          </form>
        </div>
        <div class="col-md-6">
          <form id="form-redeem" class="sg-card">
            <div class="sg-card__title">Redeem</div>
            <div class="row g-3">
              <div class="col-md-7">
                <label class="form-label small text-secondary" for="redeem-amount">Amount</label>
                <input id="redeem-amount" name="amount" type="text" class="form-control" placeholder="0" />
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-md-5">
                <label class="form-label small text-secondary" for="redeem-denom">Denom</label>
                <input id="redeem-denom" name="denom" type="text" class="form-control" placeholder="ualpha" />
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-12"><button class="btn btn-warning" data-action="redeem">Redeem</button></div>
            </div>
          </form>
        </div>
        <div class="col-md-12">
          <form id="form-confiscate" class="sg-card">
            <div class="sg-card__title">Confiscate &amp; burn</div>
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label small text-secondary" for="cb-from">From address</label>
                <input id="cb-from" name="from_address" type="text" class="form-control" />
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-md-3">
                <label class="form-label small text-secondary" for="cb-amount">Amount token</label>
                <input id="cb-amount" name="amount_token" type="text" class="form-control" />
                <div class="invalid-feedback"></div>
              </div>
              <div class="col-md-3 d-none">
                <label class="form-label small text-secondary" for="cb-denom">Denom</label>
                <input id="cb-denom" name="denom" type="hidden" value="" />
              </div>
              <div class="col-12"><button class="btn btn-danger" data-action="confiscate">Confiscate &amp; burn</button></div>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  bind() {
    if (!this.container) return;
    const amountSchema = { amount: [required(), pattern(/^\d+$/, "Whole numbers only")], denom: [required()] };
    const mintSchema = {
      amount_alpha: [required(), pattern(/^\d+$/, "Whole numbers only")],
      amount_token: [required(), pattern(/^\d+$/, "Whole numbers only")],
    };

    const container = this.container;
    container.querySelector('[data-action="mint"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const form = /** @type {HTMLFormElement} */ (container.querySelector("#form-mint"));
      const v = readFormValues(form);
      const { valid, errors } = validateForm(mintSchema, v);
      if (!valid) return notify.formError("form-mint", errors);
      void this.store.tx?.enqueue(
        this.bankManager.buildMint({ amountAlpha: v.amount_alpha, amountToken: v.amount_token }),
      );
      notify.toast("Mint enqueued", "info");
    });

    container.querySelector('[data-action="redeem"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const form = /** @type {HTMLFormElement} */ (container.querySelector("#form-redeem"));
      const v = readFormValues(form);
      const { valid, errors } = validateForm(amountSchema, v);
      if (!valid) return notify.formError("form-redeem", errors);
      void this.store.tx?.enqueue(this.bankManager.buildRedeem({ amount: v.amount, denom: v.denom }));
      notify.toast("Redeem enqueued", "info");
    });

    container.querySelector('[data-action="confiscate"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const form = /** @type {HTMLFormElement} */ (container.querySelector("#form-confiscate"));
      const v = readFormValues(form);
      const { valid, errors } = validateForm({ amount_token: [required(), pattern(/^\d+$/, "Whole numbers only")], from_address: [required()] }, v);
      if (!valid) return notify.formError("form-confiscate", errors);
      void this.store.tx?.enqueue(
        this.bankManager.buildConfiscateAndBurn({ fromAddress: v.from_address, amountToken: v.amount_token }),
      );
      notify.toast("Confiscate enqueued", "info");
    });
  }
}
