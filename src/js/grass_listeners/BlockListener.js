import { AbstractGrassListener } from "../framework/AbstractGrassListener.js";
import { EVENTS } from "../constants/Events.js";

/**
 * Listens for block-height updates. Dispatches a window event so any tx queue
 * that wants to retry on new blocks can react.
 */
export class BlockListener extends AbstractGrassListener {
  constructor() {
    super("BlockListener");
    this.lastHeight = 0;
  }

  handler(messageData) {
    if (!messageData || messageData.category !== "block") return;
    const height = Number(messageData.height ?? 0);
    if (height > this.lastHeight) {
      this.lastHeight = height;
      window.dispatchEvent(new CustomEvent(EVENTS.BLOCK_HEIGHT_CHANGED, { detail: { height } }));
    }
  }
}
