const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { startServer } = require("./server");
const { launch, open, expectClean } = require("./helpers");

const WEB = path.resolve(__dirname, "..", "..", "web");
const menuTexts = (t) => t.page.locator(".menu-header > div").allTextContents();

describe("menus, the about page and the 404 page", () => {
  let site, browser;
  before(async () => { site = await startServer(); browser = await launch(); });
  after(async () => { await browser.close(); await site.close(); });

  describe("about page has the same menu as the other pages, for youth and demo", () => {
    const cases = [
      ["youth, default (public) menu", "/about.html", ["YOUTH", "sign", "history", "about"], "/faviconV2.png"],
      ["youth, from the leader menu", "/about.html?source=leader", ["YOUTH", "sign", "live", "history", "about"], "/faviconV2.png"],
      ["demo, default (public) menu", "/demo/about.html", ["DEMO", "in/out", "about"], "/demo/favicon-test.png"],
      ["demo, from the leader menu", "/demo/about.html?source=leader", ["DEMO", "S-in/S-out", "live", "history", "about"], "/demo/favicon-test.png"],
    ];
    for (const [name, url, expected, favicon] of cases) {
      it(name, async () => {
        const t = await open(browser, site, url);
        await t.page.waitForSelector(".menu-header");
        assert.deepEqual(await menuTexts(t), expected);
        assert.equal(new URL(await t.page.locator("link[rel=icon]").evaluate((l) => l.href)).pathname, favicon);
        await expectClean(t);
        await t.close();
      });
    }

    it("the menu's links work from the about page (youth)", async () => {
      const t = await open(browser, site, "/about.html");
      await t.page.click(".menu-header a:has-text('sign')");
      await t.page.waitForURL(`${site.url}/index.html`);
      await t.close();
      const leader = await open(browser, site, "/about.html?source=leader");
      await leader.page.click(".menu-header a:has-text('history')");
      await leader.page.waitForURL(`${site.url}/history.html?source=leader`);
      await leader.page.waitForSelector(".menu-header a:has-text('live')"); // still the leader menu
      await leader.close();
    });

    it("the menu's links work from the about page (demo) and stay in the demo site", async () => {
      const t = await open(browser, site, "/demo/about.html");
      await t.page.click(".menu-header a:has-text('in')");
      await t.page.waitForURL(`${site.url}/demo/index.html?test=in`);
      await t.close();
      const about = await open(browser, site, "/demo/index.html?test=in");
      await about.page.waitForSelector(".menu-header");
      await about.page.click(".menu-header a:has-text('about')");
      await about.page.waitForURL(`${site.url}/demo/about.html?source=user`);
      await about.page.waitForSelector(".menu-header"); // and the about page it lands on has the menu
      assert.deepEqual(await menuTexts(about), ["DEMO", "in/out", "about"]);
      await about.close();
    });
  });

  describe("the menu does not change part-way through the history pages", () => {
    it("youth (user menu): dates -> a day -> a person all keep the user menu", async () => {
      const t = await open(browser, site, "/history.html?source=user");
      await t.page.waitForSelector("#dateList a");
      assert.deepEqual(await menuTexts(t), ["YOUTH", "sign", "history", "about"]);
      await t.page.click("#dateList a:has-text('2025-08-12')");
      await t.page.waitForSelector("#recordsTable a:has-text('Alice Smith')");
      assert.deepEqual(await menuTexts(t), ["YOUTH", "sign", "history", "about"]);
      await t.page.click("#recordsTable a:has-text('Alice Smith')");
      await t.page.waitForSelector("#message:has-text('History for Alice Smith')");
      assert.deepEqual(await menuTexts(t), ["YOUTH", "sign", "history", "about"]);
      await expectClean(t);
      await t.close();
    });

    it("youth (leader menu, the default): dates -> a day -> a person all keep the leader menu", async () => {
      const t = await open(browser, site, "/history.html");
      await t.page.waitForSelector("#dateList a");
      const leader = ["YOUTH", "sign", "live", "history", "about"];
      assert.deepEqual(await menuTexts(t), leader);
      await t.page.click("#dateList a:has-text('2025-08-12')");
      await t.page.waitForSelector("#recordsTable a:has-text('Alice Smith')");
      assert.deepEqual(await menuTexts(t), leader);
      await t.page.click("#recordsTable a:has-text('Alice Smith')");
      await t.page.waitForSelector("#message:has-text('History for Alice Smith')");
      assert.deepEqual(await menuTexts(t), leader);
      await expectClean(t);
      await t.close();
    });
  });

  describe("the 404 page (what CloudFront shows for any address that does not exist)", () => {
    for (const url of ["/nothing-here", "/no/such/deep/page", "/demo/also/missing.html?x=1"]) {
      it(`${url} is styled, has the menu, and its links work`, async () => {
        const t = await open(browser, site, url, { expectNavigationStatus: 404 });
        await t.page.waitForSelector(".menu-header");
        assert.equal(await t.page.textContent("h1"), "Page not found");
        // both stylesheets and the favicon load from the site root, whatever the depth of the missing address
        const sheets = await t.page.evaluate(() => [...document.styleSheets].map((s) => new URL(s.href).pathname));
        assert.deepEqual(sheets, ["/vendor/picnic.min.css", "/sign-in-out.css"]);
        assert.equal(new URL(await t.page.locator("link[rel=icon]").evaluate((l) => l.href)).pathname, "/faviconV2.png");
        assert.equal(await t.page.evaluate(() => getComputedStyle(document.body).display), "flex"); // sign-in-out.css applied
        assert.deepEqual(await menuTexts(t), ["YOUTH", "sign", "history", "about"]);
        await expectClean(t); // no CSP violation, and no 404 for any asset
        await t.page.click(".menu-header a:has-text('about')");
        await t.page.waitForURL(`${site.url}/about.html?source=user`);
        await t.close();
      });
    }

    it("is only ever used for missing pages", async () => {
      const t = await open(browser, site, "/index.html?test=in");
      assert.notEqual(await t.page.title(), "page not found - sign-in-out");
      await t.close();
    });
  });

  describe("loading the menu", () => {
    it("a menu file that is missing is not pasted into the page (CloudFront answers it with the whole 404 page)", async () => {
      const t = await open(browser, site, "/about.html");
      await t.page.waitForSelector(".menu-header");
      await t.page.evaluate(() => {
        document.getElementById("header-container").innerHTML = "";
        loadHeader("./no-such-menu.snippet");
      });
      await t.page.waitForTimeout(300);
      assert.equal(await t.page.locator("#header-container").innerHTML(), "");
      assert.equal(await t.page.locator("h1:has-text('Page not found')").count(), 0);
      await t.close();
    });

    it("the page does not jump down when the menu arrives (its height is reserved)", async () => {
      const slowMenu = async (page) => page.route("**/header.snippet", async (route) => {
        await new Promise((r) => setTimeout(r, 500));
        const body = fs.readFileSync(path.join(WEB, "main", "header.snippet"), "utf8");
        await route.fulfill({ status: 200, contentType: "text/plain", body });
      });
      const t = await open(browser, site, "/index.html?test=in", { setup: slowMenu });
      const top = () => t.page.evaluate(() => Math.round(document.querySelector(".container").getBoundingClientRect().top));
      assert.equal(await t.page.locator(".menu-header").count(), 0, "menu should not have arrived yet");
      const before = await top();
      await t.page.waitForSelector(".menu-header");
      assert.equal(await top(), before);
      await t.close();
    });
  });

  describe("every menu fits the screen", () => {
    const menus = [["youth user", "/index.html?test=x"], ["youth leader", "/bulk.html"], ["demo user", "/demo/index.html?test=in"], ["demo leader", "/demo/bulk.html?test=in"]];
    for (const width of [280, 320, 360, 414]) {
      for (const [name, url] of menus) {
        it(`${name} menu at ${width}px wide stays on screen${width >= 320 ? ", on a single row, and the page does not scroll sideways" : " (wrapping onto a second row if it must)"}`, async () => {
          const t = await open(browser, site, url, { viewport: { width, height: 700 } });
          await t.page.waitForSelector(".menu-header");
          const m = await t.page.evaluate(() => {
            const menu = document.querySelector(".menu-header");
            const de = document.documentElement;
            return {
              menuRight: Math.max(...[...menu.children].map((c) => c.getBoundingClientRect().right)),
              menuLeft: Math.min(...[...menu.children].map((c) => c.getBoundingClientRect().left)),
              menuOverflow: menu.scrollWidth - menu.clientWidth,
              height: Math.round(menu.getBoundingClientRect().height),
              pageOverflow: de.scrollWidth - de.clientWidth,
              viewport: de.clientWidth,
            };
          });
          assert.ok(m.menuLeft >= 0 && m.menuRight <= m.viewport, `menu items run outside the screen: ${JSON.stringify(m)}`);
          assert.equal(m.menuOverflow, 0, `menu bar overflows: ${JSON.stringify(m)}`);
          if (width >= 320) {
            assert.equal(m.height, 48, "menu wrapped onto a second row");
            assert.equal(m.pageOverflow, 0, `page scrolls sideways by ${m.pageOverflow}px`);
          }
          await t.close();
        });
      }
    }
  });
});
