import { Store } from "../src/js/store/Store.js";
import { TxQueue } from "../src/js/store/TxQueue.js";

/**
 * @param {import("../src/js/framework/DTestFramework.js").DTestFramework} t
 */
export function txQueueTests(t) {
  t.suite("TxQueue", () => {
    t.it("fails immediately when no stargate attached", async () => {
      const s = new Store();
      const q = new TxQueue(s);
      const rec = await q.enqueue({ typeUrl: "/dummy", value: {} });
      t.assert.equal(rec.status, "failed");
    });

    t.it("transitions pending -> confirming -> confirmed on success", async () => {
      const s = new Store();
      const q = new TxQueue(s, {
        confirmStrategy: async () => ({ status: "confirmed", height: 42, txResult: {} }),
      });
      const fakeStargate = {
        async signAndBroadcast() {
          return { code: 0, transactionHash: "ABC123", height: 41 };
        },
      };
      q.attachStargate(fakeStargate, "structs1...", { amount: [], gas: "200000" });
      const rec = await q.enqueue({ typeUrl: "/dummy", value: {} });
      t.assert.equal(rec.status, "confirmed");
      t.assert.equal(rec.hash, "ABC123");
      t.assert.equal(rec.height, 42);
    });

    t.it("transitions to failed on non-zero broadcast code", async () => {
      const s = new Store();
      const q = new TxQueue(s);
      const fakeStargate = {
        async signAndBroadcast() {
          return { code: 7, transactionHash: "X" };
        },
      };
      q.attachStargate(fakeStargate, "structs1...", { amount: [], gas: "200000" });
      const rec = await q.enqueue({ typeUrl: "/dummy", value: {} });
      t.assert.equal(rec.status, "failed");
    });

    t.it("rolls back optimistic patch on failure", async () => {
      const s = new Store();
      s.write(["x"], { status: "success", data: { v: 1 }, error: null, updatedAt: Date.now(), stale: false });
      const q = new TxQueue(s);
      // no stargate -> immediate failure path
      let rolledBack = false;
      await q.enqueue(
        { typeUrl: "/dummy", value: {} },
        {
          optimisticPatch: (store) => {
            store.write(["x"], { status: "success", data: { v: 2 }, error: null, updatedAt: Date.now(), stale: true });
            return () => {
              rolledBack = true;
            };
          },
        },
      );
      t.assert.truthy(rolledBack);
    });
  });
}
