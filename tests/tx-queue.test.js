import { Store } from "../src/js/store/Store.js";
import { TxQueue, assertSerializable } from "../src/js/store/TxQueue.js";

const FEE = { amount: [], gas: "200000" };
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

/**
 * confirmStrategy that always confirms at a fixed height.
 * @type {import("../src/js/store/confirmStrategy.js").ConfirmStrategy}
 */
const confirmOk = async () => ({ status: "confirmed", height: 42, txResult: {} });

/**
 * @param {import("../src/js/framework/DTestFramework.js").DTestFramework} t
 */
export function txQueueTests(t) {
  t.suite("TxQueue", () => {
    t.it("queues (stays pending) when no stargate is attached", () => {
      const s = new Store();
      const q = new TxQueue(s, { blockPacing: false });
      void q.enqueue({ typeUrl: "/dummy", value: {} });
      const recs = q.list();
      t.assert.equal(recs.length, 1);
      t.assert.equal(recs[0].status, "pending");
      q.destroy();
    });

    t.it("transitions pending -> confirming -> confirmed on success", async () => {
      const s = new Store();
      const q = new TxQueue(s, { blockPacing: false, confirmStrategy: confirmOk });
      q.attachStargate(
        {
          async signAndBroadcast() {
            return { code: 0, transactionHash: "ABC123", height: 41 };
          },
        },
        "structs1abc",
        FEE,
      );
      const rec = await q.enqueue({ typeUrl: "/dummy", value: {} });
      t.assert.equal(rec.status, "confirmed");
      t.assert.equal(rec.hash, "ABC123");
      t.assert.equal(rec.height, 42);
      q.destroy();
    });

    t.it("transitions to failed on non-zero broadcast code", async () => {
      const s = new Store();
      const q = new TxQueue(s, { blockPacing: false });
      q.attachStargate(
        {
          async signAndBroadcast() {
            return { code: 7, transactionHash: "X" };
          },
        },
        "structs1abc",
        FEE,
      );
      const rec = await q.enqueue({ typeUrl: "/dummy", value: {} });
      t.assert.equal(rec.status, "failed");
      q.destroy();
    });

    t.it("rolls back optimistic patch on terminal failure", async () => {
      const s = new Store();
      s.write(["x"], { status: "success", data: { v: 1 }, error: null, updatedAt: Date.now(), stale: false });
      const q = new TxQueue(s, { blockPacing: false });
      q.attachStargate(
        {
          async signAndBroadcast() {
            return { code: 9, transactionHash: "X" };
          },
        },
        "structs1abc",
        FEE,
      );
      let rolledBack = false;
      const rec = await q.enqueue(
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
      t.assert.equal(rec.status, "failed");
      t.assert.truthy(rolledBack);
      q.destroy();
    });

    t.it("serializes broadcasts: never more than one signAndBroadcast in flight", async () => {
      const s = new Store();
      let active = 0;
      let maxActive = 0;
      let n = 0;
      const q = new TxQueue(s, { blockPacing: false, confirmStrategy: confirmOk });
      q.attachStargate(
        {
          async signAndBroadcast() {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await tick(5);
            active -= 1;
            return { code: 0, transactionHash: `H${++n}`, height: 1 };
          },
        },
        "structs1abc",
        FEE,
      );
      await Promise.all([
        q.enqueue({ typeUrl: "/dummy", value: {} }),
        q.enqueue({ typeUrl: "/dummy", value: {} }),
        q.enqueue({ typeUrl: "/dummy", value: {} }),
      ]);
      t.assert.equal(maxActive, 1);
      q.destroy();
    });

    t.it("retries up to retryLimit then fails", async () => {
      const s = new Store();
      const q = new TxQueue(s, { blockPacing: false, retryBackoffMs: 0 });
      q.attachStargate(
        {
          async signAndBroadcast() {
            return { code: 5, transactionHash: "X" };
          },
        },
        "structs1abc",
        FEE,
      );
      const rec = await q.enqueue({ typeUrl: "/dummy", value: {} }, { retryLimit: 1 });
      t.assert.equal(rec.status, "failed");
      t.assert.equal(rec.attempts, 2); // 1 initial + 1 retry
      q.destroy();
    });

    t.it("cancel removes a pending tx", async () => {
      const s = new Store();
      const q = new TxQueue(s, { blockPacing: false }); // no stargate -> stays pending
      const settled = q.enqueue({ typeUrl: "/dummy", value: {} });
      const id = q.list()[0].id;
      const ok = q.cancel(id);
      t.assert.truthy(ok);
      const rec = await settled;
      t.assert.equal(rec.status, "cancelled");
      q.destroy();
    });

    t.it("moveUp and reorder change pending order", () => {
      const s = new Store();
      const q = new TxQueue(s, { blockPacing: false }); // no stargate -> all stay pending
      void q.enqueue({ typeUrl: "/a", value: {} });
      void q.enqueue({ typeUrl: "/b", value: {} });
      void q.enqueue({ typeUrl: "/c", value: {} });
      const [a, b, c] = q.queue();
      q.moveUp(c.id); // [a, c, b]
      t.assert.deepEqual(
        q.queue().map((r) => r.typeUrl),
        ["/a", "/c", "/b"],
      );
      q.reorder(a.id, 2); // [c, b, a]
      t.assert.deepEqual(
        q.queue().map((r) => r.typeUrl),
        ["/c", "/b", "/a"],
      );
      void b;
      q.destroy();
    });

    t.it("whenSettled resolves synthetic failed for unknown id", async () => {
      const s = new Store();
      const q = new TxQueue(s, { blockPacing: false });
      const rec = await q.whenSettled("does-not-exist");
      t.assert.equal(rec.status, "failed");
      q.destroy();
    });

    t.it("block pacing holds the second tx until the next block", async () => {
      const s = new Store();
      const q = new TxQueue(s, { blockPacing: false, confirmStrategy: confirmOk });
      let n = 0;
      q.attachStargate(
        {
          async signAndBroadcast() {
            await tick(2);
            return { code: 0, transactionHash: `H${++n}`, height: 1 };
          },
        },
        "structs1abc",
        FEE,
      );
      q._handleBlock(1); // establish block-driven pacing at height 1
      const p1 = q.enqueue({ typeUrl: "/a", value: {} });
      void q.enqueue({ typeUrl: "/b", value: {} });
      const id2 = q.list()[1].id;
      await p1;
      // governor: lastBroadcastHeight(1) >= currentHeight(1) -> second held
      t.assert.equal(q.getTransaction(id2)?.status, "pending");
      q._handleBlock(2);
      const rec2 = await q.whenSettled(id2);
      t.assert.equal(rec2.status, "confirmed");
      q.destroy();
    });

    t.it("interrupted (mid-broadcast) txs rehydrate as failed, never re-broadcast", () => {
      const s = new Store();
      const ws = "wsTEST";
      const addr = "structs1persist";
      const key = `signingQueue:${ws}:${addr}`;
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }

      // q1: signAndBroadcast never resolves -> record gets stuck in "signing" and persisted.
      const q1 = new TxQueue(s, { blockPacing: false });
      q1.attachStargate({ signAndBroadcast: () => new Promise(() => {}) }, addr, FEE, ws);
      void q1.enqueue({ typeUrl: "/structs.structs.MsgDummy", value: { creator: addr } });
      t.assert.equal(q1.list()[0].status, "signing");

      // q2: fresh queue, same key -> loads snapshot, downgrades signing -> failed.
      const s2 = new Store();
      const q2 = new TxQueue(s2, { blockPacing: false });
      let broadcastCalled = false;
      q2.attachStargate(
        {
          async signAndBroadcast() {
            broadcastCalled = true;
            return { code: 0, transactionHash: "Z" };
          },
        },
        addr,
        FEE,
        ws,
      );
      const restored = q2.list();
      t.assert.equal(restored.length, 1);
      t.assert.equal(restored[0].status, "failed");
      t.assert.falsy(broadcastCalled);

      q1.destroy();
      q2.clear();
      q2.destroy();
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    });

    t.it("assertSerializable rejects bigint and functions", async () => {
      await t.assert.throws(() => assertSerializable({ x: 1n }));
      await t.assert.throws(() => assertSerializable({ fn: () => {} }));
      assertSerializable({ ok: "yes", n: 1, nested: { a: [1, 2, 3] } });
    });
  });
}
