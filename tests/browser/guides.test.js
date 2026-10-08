const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("./server");
const { launch, open, expectClean } = require("./helpers");

describe("the age manager guide and the demo guides in a real browser", () => {
  let site, browser;
  before(async () => { site = await startServer(); browser = await launch(); });
  after(async () => { await browser.close(); await site.close(); });

  it("the age manager guide loads cleanly (styled, nothing blocked by the security policy), with the AM menu", async () => {
    const t = await open(browser, site, "/am/");
    await t.page.waitForSelector("h1");
    assert.equal(await t.page.textContent("h1"), "Age Manager guide");
    const sheets = await t.page.evaluate(() => [...document.styleSheets].map((s) => new URL(s.href).pathname));
    assert.deepEqual(sheets, ["/am/vendor/picnic.min.css", "/am/sign-in-out.css", "/am/guide.css"]);
    assert.equal(await t.page.locator(".guide-steps li").count(), 8);
    await t.page.waitForSelector(".menu-header");
    assert.deepEqual(await t.page.locator(".menu-header > div").allTextContents(), ["AM", "sign", "live", "history", "about"]);
    await expectClean(t);
    await t.page.click(".menu-header a:has-text('sign')");
    await t.page.waitForURL(`${site.url}/am/bulk.html`);
    await t.close();
  });

  it("fits a phone screen, with link cards big enough to tap", async () => {
    const t = await open(browser, site, "/am/", { viewport: { width: 320, height: 800 } });
    await t.page.waitForSelector("h1");
    assert.equal(await t.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    const heights = await t.page.locator(".guide-links a").evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().height)));
    assert.ok(heights.every((h) => h >= 44), `a link is too small to tap: ${heights}`);
    await t.close();
  });

  it("the practice links lead from the guides to demo pages that work on any day", async () => {
    const weekday = new Date(2025, 7, 13, 9, 0); // a Wednesday: the real site would say 'next session'
    const cases = [
      // [start page, link to click, where it lands, what must appear there, the demo menu label]
      ["/am/", "Practise on the demo", "/demo-am/", "h1:has-text('Demo for age managers')", "DEMO-A"],
      ["/demo-am/", "Practise bulk sign in", "/demo-am/bulk.html?test=in", "#bulkSubmitButton:has-text('Bulk Sign In')", "DEMO-A"],
      ["/demo-am/", "Practise bulk sign out", "/demo-am/bulk.html?test=out", "#bulkSubmitButton:has-text('Bulk Sign Out')", "DEMO-A"],
      ["/demo/guide.html", "Practise signing in", "/demo/index.html?test=in", "#submitButton:has-text('Sign In')", "DEMO-Y"],
      ["/demo/guide.html", "Practise signing out", "/demo/index.html?test=out", "#submitButton:has-text('Sign Out')", "DEMO-Y"],
    ];
    for (const [start, link, url, ready, label] of cases) {
      const t = await open(browser, site, start, { now: weekday });
      await t.page.click(`.guide-links a:has-text("${link}")`);
      await t.page.waitForURL(`${site.url}${url}`);
      await t.page.waitForSelector(ready);
      assert.deepEqual(await t.page.locator(".menu-header .menu-left").allTextContents(), [label]);
      await expectClean(t);
      await t.close();
    }
  });
});
