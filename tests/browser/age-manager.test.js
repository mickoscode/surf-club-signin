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
    assert.deepEqual(sheets, ["/age-manager/vendor/picnic.min.css", "/age-manager/sign-in-out.css", "/age-manager/age-manager.css"]);
    assert.equal(await t.page.locator(".am-steps li").count(), 8);
    assert.equal(await t.page.evaluate(() => /latif/i.test(document.body.textContent)), false);
    await expectClean(t);
    await t.close();
  });

  for (const width of [320, 375, 414, 1280]) {
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

  it("'Practise on the demo first' jumps to the practice section", async () => {
    const t = await open(browser, site, "/age-manager/");
    await t.page.click("a[href='#practice']");
    await t.page.waitForFunction(() => location.hash === "#practice");
    assert.equal(await t.page.locator("#practice h2").textContent(), "Practise any time on the demo");
    await t.close();
  });

  describe("following the guide's own links", () => {
    it("the practice links open the demo pages, which work on any day: bulk sign in, bulk sign out, one youth in and out", async () => {
      const weekday = new Date(2025, 7, 13, 9, 0); // a Wednesday: the real youth site would say 'next session'
      const cases = [
        ["Practise bulk sign in", "/demo/bulk.html?test=in", "#bulkSubmitButton:has-text('Bulk Sign In')"],
        ["Practise bulk sign out", "/demo/bulk.html?test=out", "#bulkSubmitButton:has-text('Bulk Sign Out')"],
        ["Practise signing one in", "/demo/index.html?test=in", "#submitButton:has-text('Sign In')"],
        ["Practise signing one out", "/demo/index.html?test=out", "#submitButton:has-text('Sign Out')"],
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

    it("the same day, the real youth bulk page says when the next session is (which is why the demo exists)", async () => {
      const t = await open(browser, site, "/age-manager/", { now: new Date(2025, 7, 13, 9, 0) });
      await t.page.click("a:has-text('Bulk sign in / out')");
      await t.page.waitForURL(`${site.url}/bulk.html`);
      await t.page.waitForSelector("#message:has-text('The next session is')");
      await t.close();
    });

    it("'Sign one youth in / out' and the sign-in page link lead to the normal page that every youth uses", async () => {
      for (const label of ["Sign one youth in / out", "sign-in page"]) {
        const t = await open(browser, site, "/age-manager/", { now: new Date(2025, 7, 10, 8, 30) });
        await t.page.click(`a:has-text("${label}")`);
        await t.page.waitForURL(`${site.url}/index.html`);
        await t.page.waitForSelector("#submitButton:has-text('Sign In')");
        assert.deepEqual(await t.page.locator(".menu-header .menu-left").allTextContents(), ["YOUTH"]);
        await t.close();
      }
    });

    it("the Sunday links to live count and history work, and the about link keeps the leader menu", async () => {
      const live = await open(browser, site, "/age-manager/", { now: new Date(2025, 7, 10, 8, 30) });
      await live.page.click("a:has-text('Live count') >> nth=0");
      await live.page.waitForURL(`${site.url}/live.html?source=leader`);
      await live.page.waitForSelector("#liveTotal");
      await live.close();

      const history = await open(browser, site, "/age-manager/");
      await history.page.click("a:has-text('History') >> nth=0");
      await history.page.waitForURL(`${site.url}/history.html?source=leader`);
      await history.page.waitForSelector("#dateList a");
      await history.close();

      const about = await open(browser, site, "/age-manager/");
      await about.page.click("a:has-text('about')");
      await about.page.waitForURL(`${site.url}/about.html?source=leader`);
      await about.page.waitForSelector(".menu-header a:has-text('live')");
      await about.close();
    });
  });
});
