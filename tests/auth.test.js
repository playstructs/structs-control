import { Session } from "../src/js/store/session.js";

/**
 * @param {import("../src/js/framework/DTestFramework.js").DTestFramework} t
 */
export function authTests(t) {
  t.suite("Session", () => {
    t.it("hydrates empty when sessionStorage is empty", () => {
      sessionStorage.clear();
      const s = new Session();
      t.assert.equal(s.hydrate(), null);
      t.assert.falsy(s.isAuthenticated());
    });

    t.it("round-trips through sessionStorage", () => {
      sessionStorage.clear();
      const s = new Session();
      s.persist({ mnemonic: "abandon abandon ability", address: "structs1abc", pubkey: "deadbeef", playerId: "0-1", guildId: "0-1" });
      const s2 = new Session();
      const data = s2.hydrate();
      t.assert.equal(data?.playerId, "0-1");
      t.assert.truthy(s2.isAuthenticated());
    });

    t.it("never writes to localStorage", () => {
      localStorage.clear();
      sessionStorage.clear();
      const s = new Session();
      s.persist({ mnemonic: "x", address: "y", pubkey: "z", playerId: "0-1", guildId: "0-1" });
      t.assert.equal(localStorage.length, 0);
    });

    t.it("clear() wipes session", () => {
      sessionStorage.clear();
      const s = new Session();
      s.persist({ mnemonic: "x", address: "y", pubkey: "z", playerId: "0-1", guildId: "0-1" });
      s.clear();
      t.assert.falsy(s.isAuthenticated());
    });
  });
}
