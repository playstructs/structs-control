import { AbstractController } from "../framework/AbstractController.js";
import { AbstractViewModel } from "../framework/AbstractViewModel.js";
import { LayoutViewModel } from "../view_models/LayoutViewModel.js";
import { DTestFramework } from "../framework/DTestFramework.js";
import { storeTests } from "../../../tests/store.test.js";
import { authTests } from "../../../tests/auth.test.js";
import { txQueueTests } from "../../../tests/tx-queue.test.js";
import { gridIndexTests } from "../../../tests/grid-index.test.js";
import { unitDisplayTests } from "../../../tests/unit-display.test.js";
import { entityLinkTests } from "../../../tests/entity-link.test.js";
import { percentDisplayTests } from "../../../tests/percent-display.test.js";
import { tableFiltersTests } from "../../../tests/table-filters.test.js";
import { filterUnitsTests } from "../../../tests/filter-units.test.js";
import { pfpTests } from "../../../tests/pfp.test.js";

/**
 * /dev/tests -- runs the in-browser test suite and renders results.
 */
export class DevTestsController extends AbstractController {
  constructor(deps) {
    super("DevTests", deps.store);
    this.layout = deps.layout;
  }

  activate() {
    this.layout.mountContent(new DevTestsViewModel());
  }
}

class DevTestsViewModel extends AbstractViewModel {
  constructor() {
    super();
    this.results = null;
    this.running = false;
  }

  async mount(container) {
    this.container = container;
    this._mounted = true;
    this.update();
    await this.runTests();
  }

  async runTests() {
    this.running = true;
    this.update();
    const t = new DTestFramework();
    storeTests(t);
    authTests(t);
    txQueueTests(t);
    gridIndexTests(t);
    unitDisplayTests(t);
    entityLinkTests(t);
    percentDisplayTests(t);
    tableFiltersTests(t);
    filterUnitsTests(t);
    pfpTests(t);
    this.results = await t.run();
    this.running = false;
    this.update();
  }

  render() {
    return `
      ${LayoutViewModel.pageHeader({
        title: "Tests",
        subtitle: "Critical-path checks for Store, Auth, TxQueue, grid index, unit display, and entity links.",
        actionsHtml: `<button class="btn btn-primary btn-sm" data-action="run" ${this.running ? "disabled" : ""}>${this.running ? "Running..." : "Re-run"}</button>`,
      })}
      ${this.running ? '<div class="sg-loading"><div class="spinner-border text-primary"></div></div>' : this._resultsHtml()}
    `;
  }

  _resultsHtml() {
    if (!this.results) return "";
    const t = new DTestFramework();
    return t.toHtml(this.results);
  }

  bind() {
    this.container?.querySelector('[data-action="run"]')?.addEventListener("click", () => this.runTests());
  }
}
