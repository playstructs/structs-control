/**
 * Composition root for structs-control.
 *
 * Boot order:
 *   1.  Style imports + a la carte Bootstrap JS (Modal/Dropdown/Tooltip/Collapse).
 *   2.  Read runtime config (window.STRUCTS_CONFIG -> Store.config).
 *   3.  Instantiate Store, QueryClient, TxQueue, InvalidationBridge, Session.
 *   4.  Instantiate API + WalletManager + SigningClientManager + AuthManager.
 *   5.  Instantiate domain managers.
 *   6.  Try restore() the session against the API.
 *   7.  If authenticated: mount Layout + register controllers + start router.
 *       Else: mount the login page.
 *   8.  Lazily attach GrassManager when /guild/this resolves with a NATS URL.
 *
 * Code splitting: most controllers are loaded via `import()` so each becomes
 * its own webpack chunk (see optimization.splitChunks in webpack.config.js).
 */

import "@styles/index.scss";
import { structsLogoUrl } from "./constants/Brand.js";

document.querySelector("#boot-screen .sg-boot-screen__logo img")?.setAttribute("src", structsLogoUrl);

// A la carte Bootstrap JS -- only the components we actually use.
// `.js` extension required because package.json is "type": "module".
import "bootstrap/js/dist/modal.js";
import "bootstrap/js/dist/dropdown.js";
import "bootstrap/js/dist/collapse.js";
import "bootstrap/js/dist/tooltip.js";

import { Store } from "./store/Store.js";
import { QueryClient } from "./store/QueryClient.js";
import { TxQueue } from "./store/TxQueue.js";
import { Session } from "./store/session.js";
import { InvalidationBridge } from "./store/invalidationBridge.js";
import { notify } from "./store/notify.js";

import { GuildAPI } from "./api/GuildAPI.js";
import { WalletManager } from "./managers/WalletManager.js";
import { SigningClientManager } from "./managers/SigningClientManager.js";
import { AuthManager } from "./managers/AuthManager.js";
import { GuildManager } from "./managers/GuildManager.js";
import { PlayerManager } from "./managers/PlayerManager.js";
import { SubstationManager } from "./managers/SubstationManager.js";
import { AllocationManager } from "./managers/AllocationManager.js";
import { InfusionManager } from "./managers/InfusionManager.js";
import { ReactorManager } from "./managers/ReactorManager.js";
import { BankManager } from "./managers/BankManager.js";
import { MembershipApplicationManager } from "./managers/MembershipApplicationManager.js";
import { ProviderManager } from "./managers/ProviderManager.js";
import { AgreementManager } from "./managers/AgreementManager.js";
import { StatManager } from "./managers/StatManager.js";
import { GridManager } from "./managers/GridManager.js";

import { MenuPageRouter } from "./framework/MenuPageRouter.js";
import { GrassManager } from "./framework/GrassManager.js";
import { LayoutViewModel } from "./view_models/LayoutViewModel.js";
import { ROUTES } from "./constants/Routes.js";

import { BlockListener } from "./grass_listeners/BlockListener.js";
import { PlayerListener } from "./grass_listeners/PlayerListener.js";
import { GuildListener } from "./grass_listeners/GuildListener.js";
import { SubstationListener } from "./grass_listeners/SubstationListener.js";
import { TxListener } from "./grass_listeners/TxListener.js";
import { GridListener } from "./grass_listeners/GridListener.js";

// -- Configure ----------------------------------------------------------------

const runtimeConfig = /** @type {{ guildApiUrl?: string, chainWsUrl?: string, natsWsUrl?: string, defaultGuildId?: string, devGallery?: string }} */ (
  /** @type {any} */ (window).STRUCTS_CONFIG ?? {}
);
const buildConfig = {
  guildApiUrl: process.env.STRUCTS_GUILD_API_URL || "",
  devGallery: process.env.STRUCTS_DEV_GALLERY || "",
};

const config = {
  guildApiUrl: runtimeConfig.guildApiUrl || buildConfig.guildApiUrl,
  chainWsUrl: runtimeConfig.chainWsUrl || "",
  natsWsUrl: runtimeConfig.natsWsUrl || "",
  defaultGuildId: runtimeConfig.defaultGuildId || "",
  devGallery: runtimeConfig.devGallery || buildConfig.devGallery || "",
};

// -- Store + infrastructure ---------------------------------------------------

const store = new Store();
store.config = config;
new QueryClient(store);
new TxQueue(store);
store.session = new Session();
const bridge = new InvalidationBridge(store);

// -- API + auth ---------------------------------------------------------------

// If guildApiUrl is empty, JsonAjaxer falls back to same-origin /api (dev proxy).
const baseUrl = config.guildApiUrl ? `${config.guildApiUrl.replace(/\/$/, "")}/api` : "/api";
const guildAPI = new GuildAPI({ baseUrl });
const walletManager = new WalletManager();
const signingClientManager = new SigningClientManager(store);
const authManager = new AuthManager({ guildAPI, walletManager, signingClientManager, store });

// -- Domain managers ----------------------------------------------------------

const guildManager = new GuildManager({ store, guildAPI });
const playerManager = new PlayerManager({ store, guildAPI });
const substationManager = new SubstationManager({ store, guildAPI });
const allocationManager = new AllocationManager({ store, guildAPI });
const infusionManager = new InfusionManager({ store, guildAPI });
const reactorManager = new ReactorManager({ store, guildAPI });
const bankManager = new BankManager({ store });
const membershipApplicationManager = new MembershipApplicationManager({ store, guildAPI });
const providerManager = new ProviderManager({ store, guildAPI });
const agreementManager = new AgreementManager({ store, guildAPI });
const statManager = new StatManager({ store, guildAPI });
const gridManager = new GridManager({ store, guildAPI });

// -- Router -------------------------------------------------------------------

const router = new MenuPageRouter(ROUTES, {
  requireAuth: () => store.session?.isAuthenticated() ?? false,
  onMissingAuth: () => router.goto("/login"),
});

// Layout is created post-auth (see mountLayout()).
let layout = /** @type {LayoutViewModel | null} */ (null);
let grass = /** @type {GrassManager | null} */ (null);

function mountLayout() {
  const app = document.getElementById("app");
  if (!app) return;
  if (layout) return;
  const newLayout = new LayoutViewModel({
    store,
    router,
    onLogout: async () => {
      await authManager.logout();
      bootIntoLogin();
    },
  });
  layout = newLayout;
  newLayout.mount(app);

  // Lazy-loaded controllers: each becomes its own webpack chunk via dynamic import().
  router.registerLazyController("Overview", () =>
    import("./controllers/OverviewController.js").then((m) => new m.OverviewController({ store, layout: newLayout, guildManager, substationManager })),
  );
  router.registerLazyController("GuildDetails", () =>
    import("./controllers/GuildDetailsController.js").then((m) => new m.GuildDetailsController({ store, layout: newLayout, guildManager })),
  );
  router.registerLazyController("GuildRelationships", () =>
    import("./controllers/GuildRelationshipsController.js").then(
      (m) => new m.GuildRelationshipsController({ store, layout: newLayout, providerManager, agreementManager }),
    ),
  );
  router.registerLazyController("MembershipApplications", () =>
    import("./controllers/MembershipApplicationsController.js").then(
      (m) => new m.MembershipApplicationsController({ store, layout: newLayout, membershipManager: membershipApplicationManager }),
    ),
  );
  router.registerLazyController("Players", () =>
    import("./controllers/PlayersController.js").then((m) => new m.PlayersController({ store, layout: newLayout, router, guildManager, playerManager })),
  );
  router.registerLazyController("PlayerProfile", () =>
    import("./controllers/PlayerProfileController.js").then((m) => new m.PlayerProfileController({ store, layout: newLayout, router, playerManager, infusionManager })),
  );
  router.registerLazyController("Bank", () =>
    import("./controllers/BankController.js").then((m) => new m.BankController({ store, layout: newLayout, bankManager })),
  );
  router.registerLazyController("Substations", () =>
    import("./controllers/SubstationsController.js").then((m) => new m.SubstationsController({ store, layout: newLayout, router, substationManager, gridManager })),
  );
  router.registerLazyController("SubstationDetail", () =>
    import("./controllers/SubstationDetailController.js").then(
      (m) =>
        new m.SubstationDetailController({
          store,
          layout: newLayout,
          router,
          substationManager,
          allocationManager,
          gridManager,
        }),
    ),
  );
  router.registerLazyController("Allocations", () =>
    import("./controllers/AllocationsController.js").then(
      (m) => new m.AllocationsController({ store, layout: newLayout, router, allocationManager, gridManager }),
    ),
  );
  router.registerLazyController("Reactors", () =>
    import("./controllers/ReactorsController.js").then((m) => new m.ReactorsController({ store, layout: newLayout, router, reactorManager, gridManager })),
  );
  router.registerLazyController("ReactorProfile", () =>
    import("./controllers/ReactorProfileController.js").then(
      (m) => new m.ReactorProfileController({ store, layout: newLayout, router, infusionManager, reactorManager }),
    ),
  );
  router.registerLazyController("Activity", () =>
    import("./controllers/ActivityController.js").then((m) => new m.ActivityController({ store, layout: newLayout })),
  );
  router.registerLazyController("Dashboards", () =>
    import("./controllers/DashboardsController.js").then(
      (m) => new m.DashboardsController({ store, layout: newLayout, statManager }),
    ),
  );
  router.registerLazyController("Infrastructure", () =>
    import("./controllers/InfrastructureController.js").then((m) => new m.InfrastructureController({ store, layout: newLayout })),
  );

  if (config.devGallery === "1") {
    router.registerLazyController("DevComponents", () =>
      import("./controllers/DevComponentsController.js").then((m) => new m.DevComponentsController({ store, layout: newLayout })),
    );
    router.registerLazyController("DevTests", () =>
      import("./controllers/DevTestsController.js").then((m) => new m.DevTestsController({ store, layout: newLayout })),
    );
  }
}

// -- GRASS --------------------------------------------------------------------

function startGrass() {
  if (grass) return;
  const url = config.natsWsUrl || readGuildNatsUrl();
  if (!url) return;
  grass = new GrassManager(url, "structs.>", { bridge });
  grass.registerListener(new BlockListener());
  grass.registerListener(new PlayerListener(store));
  grass.registerListener(new GuildListener(store));
  grass.registerListener(new SubstationListener(store));
  grass.registerListener(new GridListener(gridManager));
  grass.registerListener(new TxListener());
  void grass.init();
}

function readGuildNatsUrl() {
  const guild = /** @type {{ data: { grass_nats_websocket?: string } | null }} */ (store.read(["guild", "this"]));
  return guild?.data?.grass_nats_websocket ?? "";
}

// -- Auth Controller (eager; need it before layout) ---------------------------

let authControllerInstance = null;

async function bootIntoLogin() {
  layout?.unmount();
  layout = null;
  const mod = await import("./controllers/AuthController.js");
  authControllerInstance = new mod.AuthController({
    authManager,
    store,
    router,
    onAuthenticated: () => boot({ fresh: true }),
  });
  router.registerController("Auth", authControllerInstance);
  router.goto("/login");
}

// -- Boot ---------------------------------------------------------------------

async function boot(options = {}) {
  hideBootScreen(false);

  const authenticated = options.fresh
    ? (store.session?.isAuthenticated() ?? false)
    : await authManager.restore();

  if (!authenticated) {
    await bootIntoLogin();
    hideBootScreen(true);
    return;
  }

  mountLayout();

  // Prefetch the home resource that drives the sidebar + GRASS URL.
  try {
    await guildManager.fetchThisGuild();
    void gridManager.fetchIndex();
    startGrass();
  } catch (e) {
    notify.banner(
      "Could not load /guild/this. The Guild API endpoint may be unreachable. Check Settings → Infrastructure.",
      "danger",
      { id: "guild-this-error" },
    );
    void e;
  }

  const pathOnly = window.location.pathname;
  if (pathOnly === "/login" || pathOnly === "/") {
    router.goto("/overview");
  } else {
    router.start();
  }
  hideBootScreen(true);
}

function hideBootScreen(hide) {
  const el = document.getElementById("boot-screen");
  if (!el) return;
  if (hide) {
    el.setAttribute("aria-hidden", "true");
    setTimeout(() => el.remove(), 300);
  } else {
    el.setAttribute("aria-hidden", "false");
  }
}

// Surface unhandled errors as toasts so debugging is less painful.
window.addEventListener("unhandledrejection", (e) => {
  console.warn("[unhandledrejection]", e.reason);
  notify.fromError(e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
});

void boot();
