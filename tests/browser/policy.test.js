const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, policy } = require("./server");
const { launch, open, expectClean } = require("./helpers");

describe("the Content-Security-Policy under test", () => {
  let site, browser;
  before(async () => { site = await startServer(); browser = await launch(); });
  after(async () => { await browser.close(); await site.close(); });

  it("is the policy from terraform/cloudfront.tf, restricted to this site, the API and Auth0", () => {
    const text = policy.directives.join("; ");
    for (const wanted of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "frame-ancestors 'none'"]) {
      assert.ok(text.includes(wanted), `missing ${wanted} in: ${text}`);
    }
    assert.ok(!text.includes("unsafe-inline") && !text.includes("unsafe-eval"), "policy must not allow unsafe-inline/eval");
    assert.ok(text.includes(`connect-src 'self' ${policy.apiUrl} https://${policy.auth0Domain}`));
  });

  // Positive control: if the policy were not really being enforced in the browser, every "no violations" result
  // in this suite would be meaningless. So inject things the policy must refuse, and require that it does.
  describe("positive controls: the browser really enforces it", () => {
    it("blocks and reports an injected inline script", async () => {
      const t = await open(browser, site, "/demo/index.html?test=in");
      await t.page.evaluate(() => {
        const s = document.createElement("script");
        s.textContent = "window.__ran = true";
        document.body.append(s);
      });
      const ran = await t.page.evaluate(() => window.__ran);
      const violations = await t.page.evaluate(() => window.__csp);
      assert.equal(ran, undefined, "inline script must not run");
      assert.ok(violations.some((v) => v.startsWith("script-src")), `expected a script-src violation, got ${JSON.stringify(violations)}`);
      await t.close();
    });

    it("blocks a script from another host and a request to another host", async () => {
      const t = await open(browser, site, "/demo/index.html?test=in");
      const result = await t.page.evaluate(async () => {
        const s = document.createElement("script");
        s.src = "https://example.com/x.js";
        document.body.append(s);
        let fetchBlocked = false;
        try { await fetch("https://example.com/"); } catch { fetchBlocked = true; }
        return { fetchBlocked };
      });
      const violations = await t.page.evaluate(() => window.__csp);
      assert.equal(result.fetchBlocked, true, "fetch to another host must be blocked by connect-src");
      assert.ok(violations.some((v) => v.startsWith("script-src") && v.includes("example.com")), JSON.stringify(violations));
      assert.ok(violations.some((v) => v.startsWith("connect-src") && v.includes("example.com")), JSON.stringify(violations));
      await t.close();
    });

    it("blocks an inline event handler and an inline style attribute", async () => {
      const t = await open(browser, site, "/demo/info.html");
      await t.page.evaluate(() => {
        const wrap = document.createElement("div");
        wrap.innerHTML = '<img src="data:," onerror="window.__ran = true"><p id="p" style="color: red">x</p>';
        document.body.append(wrap);
      });
      await t.page.waitForTimeout(200);
      const ran = await t.page.evaluate(() => window.__ran);
      const violations = await t.page.evaluate(() => window.__csp);
      assert.equal(ran, undefined, "inline handler must not run");
      assert.ok(violations.some((v) => v.startsWith("script-src-attr")), JSON.stringify(violations));
      assert.ok(violations.some((v) => v.startsWith("style-src-attr")), JSON.stringify(violations));
      await t.close();
    });
  });

  it("an ordinary page produces no violations (so the controls above are the only ones)", async () => {
    const t = await open(browser, site, "/demo/info.html");
    await t.page.waitForLoadState("networkidle");
    await expectClean(t);
    await t.close();
  });
});
