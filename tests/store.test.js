import { Store } from "../src/js/store/Store.js";
import { QueryClient } from "../src/js/store/QueryClient.js";
import { keys } from "../src/js/store/keys.js";

/**
 * @param {import("../src/js/framework/DTestFramework.js").DTestFramework} t
 */
export function storeTests(t) {
  t.suite("Store", () => {
    t.it("returns idle by default", () => {
      const s = new Store();
      t.assert.equal(s.read(["nothing"]).status, "idle");
    });

    t.it("subscribers fire on write", () => {
      const s = new Store();
      let fired = 0;
      s.subscribe(["foo"], () => fired++);
      s.write(["foo"], { status: "success", data: 1, error: null, updatedAt: Date.now(), stale: false });
      t.assert.equal(fired, 1);
    });

    t.it("unsubscribe stops notifications", () => {
      const s = new Store();
      let fired = 0;
      const unsub = s.subscribe(["foo"], () => fired++);
      unsub();
      s.write(["foo"], { status: "success", data: 1, error: null, updatedAt: Date.now(), stale: false });
      t.assert.equal(fired, 0);
    });

    t.it("invalidate marks resources stale and matches wildcards", () => {
      const s = new Store();
      s.write(keys.player("a"), { status: "success", data: { id: "a" }, error: null, updatedAt: Date.now(), stale: false });
      s.write(keys.player("b"), { status: "success", data: { id: "b" }, error: null, updatedAt: Date.now(), stale: false });
      const n = s.invalidate(["player", "*"]);
      t.assert.equal(n, 2);
      t.assert.truthy(s.read(keys.player("a")).stale);
    });
  });

  t.suite("QueryClient", () => {
    t.it("dedupes concurrent calls", async () => {
      const s = new Store();
      new QueryClient(s);
      let calls = 0;
      const fetcher = () => {
        calls++;
        return new Promise((r) => setTimeout(() => r({ ok: true }), 20));
      };
      await Promise.all([s.query(["x"], fetcher), s.query(["x"], fetcher), s.query(["x"], fetcher)]);
      t.assert.equal(calls, 1);
    });

    t.it("respects staleTime", async () => {
      const s = new Store();
      new QueryClient(s);
      let calls = 0;
      const fetcher = async () => ({ calls: ++calls });
      await s.query(["y"], fetcher, { staleTime: 60_000 });
      await s.query(["y"], fetcher, { staleTime: 60_000 });
      t.assert.equal(calls, 1);
    });
  });
}
