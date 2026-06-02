import * as natsCore from "@nats-io/nats-core";
import { GrassError } from "../errors/GrassError.js";

/**
 * Guild Rapid Alert System Stream -- NATS WebSocket client.
 *
 * Connects to the URL provided by the Guild API (`guild.data.grass_nats_websocket`)
 * or the runtime override `window.STRUCTS_CONFIG.natsWsUrl`, subscribes to a
 * subject, and forwards messages to registered AbstractGrassListener instances.
 *
 * Optionally also feeds messages to a global InvalidationBridge so cache keys
 * are kept in sync without each listener having to reimplement the same logic.
 */
export class GrassManager {
  /**
   * @param {string} grassServerUrl
   * @param {string} subject
   * @param {{ bridge?: import("../store/invalidationBridge.js").InvalidationBridge }} [options]
   */
  constructor(grassServerUrl, subject, options = {}) {
    this.grassServerUrl = grassServerUrl;
    this.subject = subject;
    this.bridge = options.bridge ?? null;
    /** @type {Map<string, import("./AbstractGrassListener.js").AbstractGrassListener>} */
    this.listeners = new Map();
    this._nc = null;
    this._sub = null;
    this._stopped = false;
  }

  getMessageData(message) {
    try {
      return message.json();
    } catch {
      return {};
    }
  }

  /**
   * @param {import("./AbstractGrassListener.js").AbstractGrassListener} listener
   */
  registerListener(listener) {
    this.listeners.set(listener.name, listener);
  }

  unregisterListener(name) {
    this.listeners.delete(name);
  }

  async init() {
    if (!this.grassServerUrl) {
      console.warn("[GrassManager] no URL configured; skipping connect");
      return;
    }
    try {
      this._nc = await natsCore.wsconnect({ servers: this.grassServerUrl });
    } catch (e) {
      console.warn("[GrassManager] connect failed:", e);
      return;
    }
    this._sub = this._nc.subscribe(this.subject);
    (async () => {
      try {
        const sub = this._sub;
        if (!sub) return;
        for await (const message of sub) {
          if (this._stopped) break;
          const data = this.getMessageData(message);
          if (!data || typeof data !== "object") continue;

          if (this.bridge) {
            const msg = /** @type {{ subject?: string }} */ (/** @type {unknown} */ (message));
            const anyData = /** @type {{ subject?: string }} */ (data);
            this.bridge.handle(msg.subject || anyData.subject || "", data);
          }

          for (const listener of this.listeners.values()) {
            try {
              listener.handler(data);
            } catch (e) {
              console.warn(`[GrassManager] listener ${listener.name} threw:`, e);
            }
            if (listener.shouldUnregister()) this.unregisterListener(listener.name);
          }
        }
      } catch (e) {
        throw new GrassError(`GRASS subscription closed: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
  }

  async stop() {
    this._stopped = true;
    try {
      await this._sub?.unsubscribe();
    } catch {
      /* ignore */
    }
    try {
      await this._nc?.close();
    } catch {
      /* ignore */
    }
    this._sub = null;
    this._nc = null;
  }
}
