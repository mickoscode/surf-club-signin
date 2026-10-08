const { describe, it, before, after } = require("node:test");
const { startServer } = require("./server");
const { launch, open, expectClean } = require("./helpers");

// Each kind of page, loaded in real Chromium under the enforced CSP: no violations, no script errors,
// no failed or 404 requests, and the content the page is meant to show actually appears.
// (The flow tests also check this for the pages they click through; this covers the rest.)
describe("every page loads cleanly under the enforced policy", () => {
  let site, browser;
  before(async () => { site = await startServer(); browser = await launch(); });
  after(async () => { await browser.close(); await site.close(); });

  const pages = [
    ["demo sign-in (test mode)", "/demo/index.html?test=in", "#signForm:not(.hidden)"],
    ["demo bulk", "/demo-am/index.html?test=in", "#bulkForm:not(.hidden)"],
    ["demo live", "/demo-am/live.html?test=in", "#recordsTable tr:has(td)"],
    ["history (a day)", "/demo-am/history.html?date=2025-08-12", "#recordsTable a"],
    ["youth info", "/info.html", ".menu-header a"],
    ["age manager info (guide)", "/am/info.html", ".guide-steps"],
    ["demo info (youth)", "/demo/info.html", ".guide-links"],
    ["demo info (age manager)", "/demo-am/info.html", ".guide-links"],
    ["data: names", "/data/names.html", "#addForm"],
    ["data: list names", "/data/list-names.html", "#fetchNamesButton"],
    ["data: logs", "/data/logs.html", "#fetchLogsButton"],
  ];
  for (const [name, url, ready] of pages) {
    it(name, async () => {
      const t = await open(browser, site, url);
      await t.page.waitForSelector(ready, { timeout: 5000 });
      await expectClean(t);
      await t.close();
    });
  }
});
