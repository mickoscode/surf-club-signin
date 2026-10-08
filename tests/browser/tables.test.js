const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("./server");
const { launch, open } = require("./helpers");

// Realistic names, including a long hyphenated one: the tables used to be wider than the screen on a phone and scroll the page sideways.
const names = ["Aidan O'Connor", "Charlotte Henderson-Smith", "Mia Nguyen", "Liam Thompson", "Olivia Fitzgerald"].map((display, i) => ({
  activity_id: "sorrento_youth_sunday", name_id: `n${i}`, display, filter: ["u14", "u15", "u17"][i % 3],
}));
const logs = names.flatMap((n, i) => [{ name_id: n.name_id, direction: "in", date_time: `2025-08-12T0${8 + (i % 2)}:0${i}:00Z` }]);
const api = (url) => (url.includes("/name?") ? { names } : url.includes("/log?") ? { logs } : {});

describe("tables on live, history and bulk fit a phone screen", () => {
  let site, browser;
  before(async () => { site = await startServer(); browser = await launch(); });
  after(async () => { await browser.close(); await site.close(); });

  const sunday = new Date(2025, 7, 10, 9, 0);
  const pages = [["live", "/live.html", "#recordsTable tr:has(td)"], ["history (a day)", "/history.html?date=2025-08-12", "#recordsTable a"], ["bulk", "/am/bulk.html", "#bulkForm:not(.hidden)"]];
  for (const width of [360]) {
    for (const [name, url, ready] of pages) {
      it(`${name} at ${width}px: the page does not scroll sideways and the table stays inside the card`, async () => {
        const t = await open(browser, site, url, { api, now: sunday, viewport: { width, height: 700 } });
        await t.page.waitForSelector(ready);
        if (name === "bulk") await t.page.click("#filterButtons button:has-text('All')");
        const m = await t.page.evaluate(() => {
          const card = document.querySelector(".container").getBoundingClientRect();
          const table = document.querySelector("table").getBoundingClientRect();
          return { pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, tableOverCard: Math.round(table.right - card.right) };
        });
        assert.equal(m.pageOverflow, 0, `page scrolls sideways by ${m.pageOverflow}px`);
        assert.ok(m.tableOverCard <= 0, `table sticks out of the card by ${m.tableOverCard}px`);
        await t.close();
      });
    }
  }
});
