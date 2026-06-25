import { Registry } from "@cosmjs/proto-signing";
import { SigningStargateClient, defaultRegistryTypes } from "@cosmjs/stargate";
import { DEFAULT_FEE } from "../constants/MessageTypes.js";

/**
 * Wraps `@cosmjs/stargate`'s SigningStargateClient. The actual queue lives in
 * `store/TxQueue` -- this class is responsible for:
 *  - holding the active SigningStargateClient
 *  - registering the Structs custom message types (when bundled)
 *  - exposing `signAndBroadcast` so TxQueue can call into it
 *
 * Custom message registration is wrapped in try/catch so the admin SPA still
 * boots when the ts/ proto outputs haven't been copied from the webapp yet --
 * unsigned reads work; tx submission will fail at TxQueue with a clear error.
 */
export class SigningClientManager {
  /**
   * @param {import("../store/Store.js").Store} store
   */
  constructor(store) {
    this.store = store;
    /** @type {SigningStargateClient | null} */
    this.signingClient = null;
    /** @type {string} */
    this.address = "";
    /** @type {Registry} */
    this.registry = new Registry(defaultRegistryTypes);
  }

  /**
   * Register Structs-specific message types from the (copied) ts/ proto output.
   * Called lazily so the SPA boots even if ts/ is missing.
   */
  async registerStructsTypes() {
    try {
      const mod = /** @type {any} */ (await import("../ts/structs.structs/registry.js"));
      this.registry = new Registry([...defaultRegistryTypes, ...(mod.msgTypes ?? [])]);
    } catch (e) {
      console.warn("[SigningClientManager] Structs proto types not available -- tx submission disabled.", e);
    }
  }

  /**
   * @param {import("@cosmjs/proto-signing").DirectSecp256k1HdWallet} wallet
   * @param {string} address
   */
  async connect(wallet, address) {
    await this.registerStructsTypes();
    const wsUrl = this._wsUrl();
    if (!wsUrl) {
      console.warn("[SigningClientManager] no chain WS URL configured -- tx submission disabled");
      return;
    }
    this.signingClient = await SigningStargateClient.connectWithSigner(wsUrl, wallet, {
      registry: this.registry,
    });
    this.address = address;
    if (this.store.tx) {
      // Pass wsUrl so the queue scopes its persisted snapshot per chain+account
      // and rehydrates any queued txs left over from a previous page load.
      this.store.tx.attachStargate(this.signingClient, address, DEFAULT_FEE, wsUrl);
    }
  }

  disconnect() {
    this.signingClient?.disconnect?.();
    this.signingClient = null;
    this.address = "";
    if (this.store.tx) this.store.tx.detachStargate();
  }

  _wsUrl() {
    const override = this.store.config.chainWsUrl;
    if (override) return override;
    const guild = /** @type {{ data: { client_websocket?: string } } | null} */ (this.store.read(["guild", "this"]));
    return guild?.data?.client_websocket ?? "";
  }
}
