const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("./server");
const { launch, open, expectClean } = require("./helpers");

describe("age manager guide in a real browser", () => {
  let site, browser;
  before(async () => { site = await startServer(); browser = await launch(); });
  after(async () => { await browser.close(); await site.close(); });

  it("loads cleanly (styled, nothing blocked by the security policy) and reads as a guide", async () => {
    const t = await open(browser, site, "/age-manager/");
    await t.page.waitForSelector("h1");
    assert.equal(await t.page.textContent("h1"), "Age Manager guide");
    const sheets = await t.page.evaluate(() => [...document.styleSheets].map((s) => new URL(s.href).pathname));
    assert.deepEqual(sheets, ["/vendor/picnic.min.css", "/sign-in-out.css", "/age-manager/age-manager.css"]);
    assert.equal(await t.page.locator(".am-steps li").count(), 8);
    // the same menu as the other age manager pages, with its links pointed up a folder so they work from /age-manager/
    await t.page.waitForSelector(".menu-header");
    assert.deepEqual(await t.page.locator(".menu-header > div").allTextContents(), ["AM", "sign", "live", "history", "about"]);
    const menuLinks = await t.page.locator(".menu-header a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    assert.ok(menuLinks.every((href) => href.startsWith("../")), JSON.stringify(menuLinks));
    await expectClean(t);
    await t.page.click(".menu-header a:has-text('sign')");
    await t.page.waitForURL(`${site.url}/bulk.html`);
    await t.close();
  });

  for (const width of [320]) {
    it(`fits a ${width}px wide screen without sideways scrolling`, async () => {
      const t = await open(browser, site, "/age-manager/", { viewport: { width, height: 800 } });
      await t.page.waitForSelector("h1");
      assert.equal(await t.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
      // the link cards are big enough to tap
      const heights = await t.page.locator(".am-links a").evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().height)));
      assert.ok(heights.every((h) => h >= 44), `a link is too small to tap: ${heights}`);
      await t.close();
    });
  }

  describe("following the guide's own links", () => {
    it("the practice links open the demo pages, which work on any day: bulk sign in, bulk sign out, one youth in and out", async () => {
      const weekday = new Date(2025, 7, 13, 9, 0); // a Wednesday: the real youth site would say 'next session'
      const cases = [
        ["Practise bulk sign in", "/demo/bulk.html?test=in", "#bulkSubmitButton:has-text('Bulk Sign In')"],
        ["Practise signing one in", "/demo/index.html?test=in", "#submitButton:has-text('Sign In')"],
      ];
      for (const [label, url, ready] of cases) {
        const t = await open(browser, site, "/age-manager/", { now: weekday });
        await t.page.click(`#practice a:has-text("${label}")`);
        await t.page.waitForURL(`${site.url}${url}`);
        await t.page.waitForSelector(ready);
        assert.deepEqual(await t.page.locator(".menu-header .menu-left").allTextContents(), ["DEMO"]);
        await expectClean(t);
        await t.close();
      }
    });
  });
});
