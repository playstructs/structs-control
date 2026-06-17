import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";

/** @type {Record<string, { title: string, subtitle: string }>} */
const PAGES = {
  overview: { title: "Overview", subtitle: "Energy snapshot for this guild." },
  details: { title: "Details", subtitle: "Energy entity settings and metadata." },
  validators: { title: "Validators", subtitle: "Validators connected to guild reactors." },
  permissions: { title: "Permissions", subtitle: "Who can manage energy infrastructure." },
  market: { title: "Energy Market", subtitle: "Buy and sell energy on the open market." },
};

/**
 * Placeholder pages for the Energy section pill nav (Figma flows).
 */
export class EnergySectionController extends AbstractController {
  constructor(deps) {
    super("EnergySection", deps.store);
    this.layout = deps.layout;
  }

  activate(page) {
    const meta = PAGES[page] ?? PAGES.overview;
    this.layout.mountContent(new EnergySectionViewModel(meta));
  }
}

class EnergySectionViewModel extends AbstractViewModel {
  /** @param {{ title: string, subtitle: string }} meta */
  constructor(meta) {
    super();
    this.meta = meta;
  }

  render() {
    return `
      <div class="sg-empty mt-1">
        <div class="sg-empty__title">${escapeHtml(this.meta.title)}</div>
        <div class="sg-empty__hint">${escapeHtml(this.meta.subtitle)} Coming soon.</div>
      </div>
    `;
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
