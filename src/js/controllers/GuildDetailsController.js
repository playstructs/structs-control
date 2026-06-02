import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { ResourceView } from "../view_models/components/ResourceView.js";
import { floatingLabelField } from "../view_models/components/FloatingLabelField.js";
import { MSG_TYPES } from "../constants/MessageTypes.js";
import { notify } from "../store/notify.js";
import { readFormValues } from "../util/validate.js";
import { keys } from "../store/keys.js";

/**
 * Guild Details page: form with chain-tx-signed updates for guild endpoints,
 * entry substation, infusion settings, name, pfp.
 *
 * Every save enqueues a tx via store.tx; the form locks until the tx settles.
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
  }

  mount(container) {
    super.mount(container);
    this.subscribe(this.store, keys.guild(this.guildId));
  }

  render() {
    const guild = this.store.read(keys.guild(this.guildId));
    return `
      ${LayoutViewModel.pageHeader({ title: "Guild details", subtitle: "Settings written on-chain. Saves enqueue a signed transaction." })}
      ${ResourceView.render(guild, {
        success: (g) => `
          <div class="row g-3">
            <div class="col-md-6">
              <form id="form-name" class="sg-card">
                <div class="sg-card__title">Name + avatar</div>
                <div class="row g-3">
                  <div class="col-12">${floatingLabelField({ id: "g-name", name: "name", label: "Name", value: g?.name ?? "" })}</div>
                  <div class="col-12">${floatingLabelField({ id: "g-pfp", name: "pfp", label: "Avatar URL", value: g?.pfp ?? "" })}</div>
                  <div class="col-12 d-flex gap-2">
                    <button class="btn btn-primary" data-action="save-name">Save name</button>
                    <button class="btn btn-light" data-action="save-pfp">Save avatar</button>
                  </div>
                </div>
              </form>
            </div>
            <div class="col-md-6">
              <form id="form-entry" class="sg-card">
                <div class="sg-card__title">Entry policy</div>
                <div class="row g-3">
                  <div class="col-12">${floatingLabelField({ id: "g-entry-sub", name: "entry_substation_id", label: "Entry substation ID", value: g?.entry_substation_id ?? "" })}</div>
                  <div class="col-12">${floatingLabelField({ id: "g-entry-rank", name: "entry_rank", label: "Entry rank", value: String(g?.entry_rank ?? "") })}</div>
                  <div class="col-12">${floatingLabelField({ id: "g-infusion-min", name: "join_infusion_minimum", label: "Join infusion minimum", value: g?.join_infusion_minimum ?? "" })}</div>
                  <div class="col-12 d-flex gap-2">
                    <button class="btn btn-light" data-action="save-entry-sub">Save substation</button>
                    <button class="btn btn-light" data-action="save-entry-rank">Save rank</button>
                    <button class="btn btn-light" data-action="save-infusion-min">Save min infusion</button>
                  </div>
                </div>
              </form>
            </div>
            <div class="col-md-12">
              <form id="form-endpoint" class="sg-card">
                <div class="sg-card__title">Endpoint</div>
                <div class="row g-3">
                  <div class="col-12">${floatingLabelField({ id: "g-endpoint", name: "endpoint", label: "Endpoint URL (Guild API base URL)", value: g?.endpoint ?? "" })}</div>
                  <div class="col-12"><button class="btn btn-primary" data-action="save-endpoint">Save endpoint</button></div>
                </div>
              </form>
            </div>
          </div>
        `,
      })}
    `;
  }

  bind() {
    if (!this.container) return;
    const enqueue = (typeUrl, value, ok = "Saved") => {
      this.store.tx?.enqueue({ typeUrl, value: { creator: "", guild_id: this.guildId, ...value } }, { invalidate: [keys.guild(this.guildId)] });
      notify.toast(`Transaction enqueued: ${ok}`, "info");
    };

    const formName = this.container.querySelector("#form-name");
    const formEntry = this.container.querySelector("#form-entry");
    const formEndpoint = this.container.querySelector("#form-endpoint");

    this.container.querySelector('[data-action="save-name"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const v = readFormValues(/** @type {HTMLFormElement} */ (formName));
      enqueue(MSG_TYPES.GUILD_UPDATE_NAME, { name: v.name }, "Name update");
    });
    this.container.querySelector('[data-action="save-pfp"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const v = readFormValues(/** @type {HTMLFormElement} */ (formName));
      enqueue(MSG_TYPES.GUILD_UPDATE_PFP, { pfp: v.pfp }, "Avatar update");
    });
    this.container.querySelector('[data-action="save-entry-sub"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const v = readFormValues(/** @type {HTMLFormElement} */ (formEntry));
      enqueue(MSG_TYPES.GUILD_UPDATE_ENTRY_SUBSTATION_ID, { entry_substation_id: v.entry_substation_id }, "Entry substation");
    });
    this.container.querySelector('[data-action="save-entry-rank"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const v = readFormValues(/** @type {HTMLFormElement} */ (formEntry));
      enqueue(MSG_TYPES.GUILD_UPDATE_ENTRY_RANK, { entry_rank: parseInt(v.entry_rank, 10) }, "Entry rank");
    });
    this.container.querySelector('[data-action="save-infusion-min"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const v = readFormValues(/** @type {HTMLFormElement} */ (formEntry));
      enqueue(MSG_TYPES.GUILD_UPDATE_JOIN_INFUSION_MINIMUM, { join_infusion_minimum: v.join_infusion_minimum }, "Join infusion min");
    });
    this.container.querySelector('[data-action="save-endpoint"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      const v = readFormValues(/** @type {HTMLFormElement} */ (formEndpoint));
      enqueue(MSG_TYPES.GUILD_UPDATE_ENDPOINT, { endpoint: v.endpoint }, "Endpoint");
    });
  }
}
