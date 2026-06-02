/**
 * Tiny in-browser test runner (Direct Test Framework). Inspired by the
 * structs-webapp class of the same name; reimplemented here so we don't pull
 * in node-only test infrastructure.
 *
 * Use:
 *   const t = new DTestFramework();
 *   t.suite("Store", () => {
 *     t.it("returns idle by default", () => {
 *       t.assert.equal(store.read(["x"]).status, "idle");
 *     });
 *   });
 *   const results = await t.run();
 *
 * Tests render as HTML via `t.toHtml()` for the /dev/tests page.
 */

/** @typedef {{ name: string, fn: () => void | Promise<void> }} TestCase */
/** @typedef {{ name: string, tests: TestCase[] }} Suite */
/** @typedef {{ suite: string, test: string, ok: boolean, error?: string, durationMs: number }} TestResult */

export class DTestFramework {
  constructor() {
    /** @type {Suite[]} */
    this._suites = [];
    /** @type {Suite | null} */
    this._current = null;
    this.assert = {
      equal(actual, expected, msg) {
        if (actual !== expected) {
          throw new Error(msg ?? `Expected ${formatValue(expected)} but got ${formatValue(actual)}`);
        }
      },
      deepEqual(actual, expected, msg) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(msg ?? `Expected ${formatValue(expected)} but got ${formatValue(actual)}`);
        }
      },
      truthy(value, msg) {
        if (!value) throw new Error(msg ?? `Expected truthy value, got ${formatValue(value)}`);
      },
      falsy(value, msg) {
        if (value) throw new Error(msg ?? `Expected falsy value, got ${formatValue(value)}`);
      },
      throws: async (fn, msg) => {
        let threw = false;
        try {
          await fn();
        } catch {
          threw = true;
        }
        if (!threw) throw new Error(msg ?? `Expected function to throw`);
      },
    };
  }

  /**
   * @param {string} name
   * @param {() => void} body
   */
  suite(name, body) {
    const suite = { name, tests: /** @type {TestCase[]} */ ([]) };
    this._current = suite;
    body();
    this._suites.push(suite);
    this._current = null;
  }

  /**
   * @param {string} name
   * @param {() => void | Promise<void>} fn
   */
  it(name, fn) {
    if (!this._current) throw new Error("it() called outside suite()");
    this._current.tests.push({ name, fn });
  }

  /** @returns {Promise<TestResult[]>} */
  async run() {
    /** @type {TestResult[]} */
    const results = [];
    for (const suite of this._suites) {
      for (const test of suite.tests) {
        const start = performance.now();
        try {
          await test.fn();
          results.push({ suite: suite.name, test: test.name, ok: true, durationMs: performance.now() - start });
        } catch (e) {
          results.push({
            suite: suite.name,
            test: test.name,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
            durationMs: performance.now() - start,
          });
        }
      }
    }
    return results;
  }

  /** @param {TestResult[]} results */
  toHtml(results) {
    const total = results.length;
    const failed = results.filter((r) => !r.ok).length;
    const summary = `<div class="alert alert-${failed ? "danger" : "success"}">${failed ? `${failed} of ${total} failed` : `${total} tests passed`}</div>`;
    const rows = results
      .map(
        (r) => `<tr class="${r.ok ? "" : "table-danger"}">
          <td><span class="badge text-bg-${r.ok ? "success" : "danger"}">${r.ok ? "ok" : "fail"}</span></td>
          <td>${escapeHtml(r.suite)}</td>
          <td>${escapeHtml(r.test)}</td>
          <td class="text-end small">${r.durationMs.toFixed(1)}ms</td>
          <td class="small text-secondary">${escapeHtml(r.error ?? "")}</td>
        </tr>`,
      )
      .join("");
    return `${summary}<table class="table"><thead><tr><th></th><th>Suite</th><th>Test</th><th class="text-end">Time</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
}

function formatValue(v) {
  try {
    return typeof v === "string" ? `"${v}"` : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
