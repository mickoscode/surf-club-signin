const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("./server");
const { launch, open, expectClean } = require("./helpers");

// Enough rows to make every page taller than the screen.
const manyNames = Array.from({ length: 40 }, (_, i) => ({
  activity_id: "sorrento_youth_sunday", name_id: `person_${i}`, display: `Person Number ${i}`, filter: ["u14", "u15", "u17", "u19"][i % 4],
}));
const manyLogs = manyNames.slice(0, 25).flatMap((n, i) => [
  { name_id: n.name_id, direction: "in", date_time: `2025-08-12T08:${String(i).padStart(2, "0")}:00Z` },
  { name_id: n.name_id, direction: "out", date_time: `2025-08-12T10:${String(i).padStart(2, "0")}:00Z` },
]);
const api = (url, { method }) => (method === "POST" ? { message: "ok" } : url.includes("/name?") ? { names: manyNames } : url.includes("/log?") ? { logs: manyLogs } : {});

const PAGES = [
  ["home", "/data/index.html", null],
  ["add / edit", "/data/names.html", ".name-list li"],
  ["names", "/data/list-names.html?activity_id=sorrento_youth_sunday", async (p) => { await p.click("#fetchNamesButton"); await p.waitForSelector("#namesTable tbody tr"); }],
  ["logs", "/data/logs.html?date=2025-08-12", async (p) => { await p.click("#fetchLogsButton"); await p.waitForSelector("#logTable tbody tr"); }],
];

async function settle(t, ready) {
  if (typeof ready === "string") await t.page.waitForSelector(ready);
  else if (ready) await ready(t.page);
}

describe("data admin pages in a real browser", () => {
  let site, browser;
  before(async () => { site = await startServer(); browser = await launch(); });
  after(async () => { await browser.close(); await site.close(); });

  describe("moving around with the menu", () => {
    it("every menu link works from every page, the same menu is on each, and the current page is marked", async () => {
      const labels = ["home", "add / edit", "names", "logs"];
      for (const [name, url, ready] of PAGES) {
        const t = await open(browser, site, url, { api });
        await settle(t, ready);
        assert.deepEqual(await t.page.locator(".menu-header a").allTextContents(), labels);
        assert.equal(await t.page.locator('.menu-header a[aria-current="page"]').textContent(), name);
        await expectClean(t);
        await t.close();
      }
      // click through all four, from the first
      const t = await open(browser, site, "/data/index.html", { api });
      for (const [label, file] of [["add / edit", "names.html"], ["names", "list-names.html"], ["logs", "logs.html"], ["home", "index.html"]]) {
        await t.page.click(`.menu-header a:has-text("${label}")`);
        await t.page.waitForURL(`${site.url}/data/${file}`);
        assert.equal(await t.page.locator('.menu-header a[aria-current="page"]').textContent(), label);
      }
      await expectClean(t);
      await t.close();
    });

    it("the home page's cards and links lead where they say", async () => {
      const t = await open(browser, site, "/data/index.html", { api });
      await t.page.click(".admin-cards a:has-text('Logs')");
      await t.page.waitForURL(`${site.url}/data/logs.html`);
      await t.page.goBack();
      await t.page.click("a:has-text('Age manager links')");
      await t.page.waitForURL(`${site.url}/age-manager/`);
      await t.close();
    });

    it("editing a name has a way back to the list, and the activity tabs switch activity", async () => {
      const edit = await open(browser, site, "/data/names.html?activity_id=sorrento_youth_sunday&name_id=person_1&filter=u15", { api });
      await edit.page.waitForSelector("#editForm");
      await edit.page.click(".back-link");
      await edit.page.waitForURL(`${site.url}/data/names.html`);
      await edit.page.waitForSelector("#addForm");
      await edit.close();

      const list = await open(browser, site, "/data/list-names.html?activity_id=sorrento_youth_sunday", { api });
      assert.equal(await list.page.locator('.admin-tabs a[aria-current="true"]').textContent(), "youth");
      await list.page.click(".admin-tabs a:has-text('demo')");
      await list.page.waitForURL(/activity_id=demo$/);
      assert.equal(await list.page.locator('.admin-tabs a[aria-current="true"]').textContent(), "demo");
      assert.equal(await list.page.textContent("#activityName"), "demo");
      await list.close();
    });
  });

  describe("layout", () => {
    for (const width of [320, 375, 414, 1280]) {
      for (const [name, url, ready] of PAGES) {
        it(`${name} at ${width}px wide: the page does not scroll sideways, and the menu stays on screen`, async () => {
          const t = await open(browser, site, url, { api, viewport: { width, height: 800 } });
          await settle(t, ready);
          const m = await t.page.evaluate(() => {
            const de = document.documentElement;
            const menu = document.querySelector(".menu-header");
            return {
              pageOverflow: de.scrollWidth - de.clientWidth,
              menuRight: Math.max(...[...menu.children].map((c) => c.getBoundingClientRect().right)),
              viewport: de.clientWidth,
            };
          });
          assert.equal(m.pageOverflow, 0, `scrolls sideways by ${m.pageOverflow}px`);
          assert.ok(m.menuRight <= m.viewport, `menu runs off the screen: ${JSON.stringify(m)}`);
          await t.close();
        });
      }
    }

    it("on a phone, the names table fits inside its card, and a wider table scrolls inside its own box (never the page)", async () => {
      const names = await open(browser, site, PAGES[2][1], { api, viewport: { width: 375, height: 800 } });
      await settle(names, PAGES[2][2]);
      assert.equal(await names.page.locator(".table-scroll").evaluate((e) => e.scrollWidth - e.clientWidth), 0);
      await names.close();

      const narrow = await open(browser, site, PAGES[3][1], { api, viewport: { width: 320, height: 800 } });
      await settle(narrow, PAGES[3][2]);
      const box = await narrow.page.locator(".table-scroll").evaluate((e) => ({ over: e.scrollWidth - e.clientWidth, css: getComputedStyle(e).overflowX }));
      assert.equal(box.css, "auto");
      assert.ok(box.over >= 0);
      assert.equal(await narrow.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
      await narrow.close();
    });

    it("select boxes are tall enough for their text (it used to be clipped)", async () => {
      const t = await open(browser, site, "/data/names.html", { api });
      await t.page.waitForSelector("#addForm");
      for (const id of ["#field-activity_id", "#field-filter"]) {
        const box = await t.page.locator(id).boundingBox();
        assert.ok(box.height >= 40, `${id} is only ${box.height}px tall`);
      }
      await t.close();
    });

    it("labels focus their fields when clicked", async () => {
      const t = await open(browser, site, "/data/logs.html", { api });
      await t.page.click("label[for=name_id]");
      assert.equal(await t.page.evaluate(() => document.activeElement.id), "name_id");
      await t.close();
    });
  });

  describe("the background covers a page taller than the screen (the gradient used to stop and restart)", () => {
    const tall = [
      ["data: names", "/data/names.html", ".name-list li"],
      ["data: logs", "/data/logs.html?date=2025-08-12", async (p) => { await p.click("#fetchLogsButton"); await p.waitForSelector("#logTable tbody tr"); }],
      ["history: a day with many people", "/history.html?date=2025-08-12", "#recordsTable a"],
    ];
    for (const [name, url, ready] of tall) {
      it(name, async () => {
        const t = await open(browser, site, url, { api, viewport: { width: 1000, height: 600 } });
        await settle(t, ready);
        const m = await t.page.evaluate(() => ({
          document: document.documentElement.scrollHeight,
          html: Math.round(document.documentElement.getBoundingClientRect().height),
          body: Math.round(document.body.getBoundingClientRect().height),
          viewport: innerHeight,
          repeat: getComputedStyle(document.body).backgroundRepeat,
        }));
        assert.ok(m.document > m.viewport, `test page is not taller than the screen: ${JSON.stringify(m)}`);
        assert.ok(m.html >= m.document - 1 && m.body >= m.document - 1, `html/body stop short of the page: ${JSON.stringify(m)}`);
        assert.equal(m.repeat, "no-repeat");
        await t.close();
      });
    }
  });
  describe("the three defaults and refreshes", () => {
    it("adding a name refreshes the Existing names list: the new name appears, once, and again after a second add", async () => {
      const stored = manyNames.slice(0, 3).map((n) => ({ ...n }));
      const stateful = (url, { method, body }) => {
        if (method === "POST") {
          stored.push({ activity_id: body.activity_id, name_id: body.display.toLowerCase().replace(/ /g, "_"), display: body.display, filter: body.filter });
          return { message: "ok" };
        }
        return url.includes("/name?") ? { names: stored } : {};
      };
      const t = await open(browser, site, "/data/names.html", { api: stateful });
      await t.page.waitForSelector(".name-list li");
      assert.equal(await t.page.locator(".name-list li").count(), 3);

      await t.page.fill("#addForm [name=display]", "First Newcomer");
      await t.page.click("#addForm button");
      await t.page.waitForSelector(".name-list li:nth-child(4)");
      assert.ok((await t.page.locator(".name-list .name-main").allTextContents()).includes("First Newcomer"));
      assert.equal(await t.page.locator("#nameListSection").count(), 1);
      assert.equal(await t.page.locator("#message").textContent(), "name added successfully");
      assert.match(await t.page.locator("#nameListSection h2").textContent(), /\(4\)$/);

      await t.page.fill("#addForm [name=display]", "Second Newcomer");
      await t.page.click("#addForm button");
      await t.page.waitForSelector(".name-list li:nth-child(5)");
      assert.equal(await t.page.locator("#nameListSection").count(), 1);
      // the new rows are links to the edit form, like the others
      await t.page.click(".name-list li:nth-child(5) a");
      await t.page.waitForSelector("#editForm");
      assert.match(t.page.url(), /name_id=second_newcomer/);
      assert.equal(await t.page.inputValue("#editForm [name=name_id]"), "second_newcomer");
      await expectClean(t);
      await t.close();
    });

    it("the names list page defaults to youth, and the tab says so", async () => {
      const t = await open(browser, site, "/data/list-names.html", { api });
      assert.equal(await t.page.textContent("#activityName"), "sorrento_youth_sunday");
      assert.equal(await t.page.locator('.admin-tabs a[aria-current="true"]').textContent(), "youth");
      await t.page.click("#fetchNamesButton");
      await t.page.waitForSelector("#namesTable tbody tr");
      assert.ok(t.calls.some((c) => c.url.includes("activity_id=sorrento_youth_sunday")));
      assert.ok(t.calls.every((c) => !c.url.includes("activity_id=demo")));
      await t.close();
    });

    it("the logs page defaults to today (UTC), shows the day, and fetches that day", async () => {
      const now = new Date(Date.UTC(2025, 8, 3, 12, 0));
      const t = await open(browser, site, "/data/logs.html", { api, now });
      assert.equal(await t.page.textContent("#logDate"), "2025-09-03");
      await t.page.click("#fetchLogsButton");
      await t.page.waitForSelector("#logTable tbody tr");
      assert.ok(t.calls.some((c) => c.url.includes("date=2025-09-03")), JSON.stringify(t.calls.map((c) => c.url)));
      assert.match(await t.page.textContent("#logsStatus"), /entries for 2025-09-03\.$/);
      await t.close();

      const explicit = await open(browser, site, "/data/logs.html?date=2025-08-12", { api, now });
      assert.equal(await explicit.page.textContent("#logDate"), "2025-08-12");
      await explicit.close();
    });
  });
});
