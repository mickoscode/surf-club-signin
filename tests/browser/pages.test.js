const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("./server");
const { launch, open, expectClean } = require("./helpers");

// Every kind of page, loaded in real Chromium under the enforced CSP: no violations, no script errors,
// no failed or 404 requests, and the content the page is meant to show actually appears.
describe("every page loads cleanly under the enforced policy", () => {
  let site, browser;
  before(async () => { site = await startServer(); browser = await launch(); });
  after(async () => { await browser.close(); await site.close(); });

  const SUNDAY_0830 = new Date(2025, 7, 10, 8, 30);

  const pages = [
    ["demo sign-in (test mode)", "/demo/index.html?test=in", "#signForm:not(.hidden)"],
    ["demo sign-out (test mode)", "/demo/index.html?test=out", "#submitButton:has-text('Sign Out')"],
    ["demo bulk", "/demo/bulk.html?test=in", "#bulkForm:not(.hidden)"],
    ["demo live", "/demo/live.html?test=in", "#recordsTable tr:has(td)"],
    ["history: dates", "/demo/history.html", "#dateList a"],
    ["history: day", "/demo/history.html?date=2025-08-12", "#recordsTable a"],
    ["history: person", "/demo/history.html?source=user&name_id=alice", "#message:has-text('History for Alice Smith')"],
    ["about", "/demo/about.html", "body"],
    ["age-manager", "/age-manager/", "a[href*='bulk.html']"],
    ["root site (web/main)", "/index.html", "body"],
    ["data: login stub", "/data/index.html", "#login"],
    ["data: names", "/data/names.html", "#addForm"],
    ["data: list names", "/data/list-names.html", "#fetchNamesButton"],
    ["data: logs", "/data/logs.html", "#fetchLogsButton"],
  ];
  for (const [name, url, ready] of pages) {
    it(name, async () => {
      const t = await open(browser, site, url);
      await t.page.waitForSelector(ready, { timeout: 5000 });
      await t.page.waitForLoadState("networkidle");
      await expectClean(t);
      await t.close();
    });
  }

  it("a real age-group site (pink) on a Sunday morning shows Sign In", async () => {
    const t = await open(browser, site, "/pink/index.html", { now: SUNDAY_0830 });
    await t.page.waitForSelector("#submitButton:has-text('Sign In')", { timeout: 5000 });
    await expectClean(t);
    await t.close();
  });

  it("a real age-group site on a weekday says when the next session is", async () => {
    const t = await open(browser, site, "/pink/index.html", { now: new Date(2025, 7, 13, 9, 0) });
    await t.page.waitForSelector("#message:has-text('The next session is 17 Aug 2025')", { timeout: 5000 });
    await expectClean(t);
    await t.close();
  });

  it("the vendored stylesheet is applied (a picnic rule takes effect)", async () => {
    const t = await open(browser, site, "/demo/index.html?test=in");
    await t.page.waitForSelector("#signForm:not(.hidden)");
    const sheets = await t.page.evaluate(() => [...document.styleSheets].map((s) => s.href.split("/").slice(-2).join("/")));
    assert.ok(sheets.includes("vendor/picnic.min.css") && sheets.some((s) => s.endsWith("sign-in-out.css")), JSON.stringify(sheets));
    // picnic styles buttons (rounded corners, a coloured background); the browser default is square and grey
    const style = await t.page.evaluate(() => {
      const css = getComputedStyle(document.getElementById("submitButton"));
      return { radius: css.borderTopLeftRadius, background: css.backgroundColor };
    });
    assert.notEqual(style.radius, "0px", JSON.stringify(style));
    await t.close();
  });
});
