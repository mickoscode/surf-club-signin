const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer } = require("./server");
const { launch, open, expectClean } = require("./helpers");

const menuTexts = (t) => t.page.locator(".menu-header > div").allTextContents();

describe("menus, the info pages and the 404 page", () => {
  let site, browser;
  before(async () => { site = await startServer(); browser = await launch(); });
  after(async () => { await browser.close(); await site.close(); });

  describe("each view has its own menu, tab icon and info page", () => {
    const cases = [
      ["youth", "/info.html", ["YOUTH", "sign", "live", "history"], "/faviconV2.png"],
      ["age manager", "/am/info.html", ["AM", "sign", "live", "history"], "/am/favicon-am.png"],
      ["demo (youth)", "/demo/info.html", ["DEMO-Y", "in/out", "live", "history"], "/demo/favicon-demo.png"],
      ["demo (age manager)", "/demo-am/info.html", ["DEMO-A", "S-in/S-out", "live", "history"], "/demo-am/favicon-demo.png"],
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

    it("the YOUTH, AM, DEMO-A and DEMO-Y labels link to the view's info page, which still has the menu", async () => {
      for (const [from, label, info, menu] of [
        ["/index.html", "YOUTH", "/info.html", ["YOUTH", "sign", "live", "history"]],
        ["/am/index.html", "AM", "/am/info.html", ["AM", "sign", "live", "history"]],
        ["/demo-am/index.html?test=in", "DEMO-A", "/demo-am/info.html", ["DEMO-A", "S-in/S-out", "live", "history"]],
        ["/demo/index.html?test=in", "DEMO-Y", "/demo/info.html", ["DEMO-Y", "in/out", "live", "history"]],
      ]) {
        const t = await open(browser, site, from);
        await t.page.waitForSelector(".menu-header");
        await t.page.click(`.menu-left a:has-text("${label}")`);
        await t.page.waitForURL(`${site.url}${info}`);
        await t.page.waitForSelector(".menu-header");
        assert.deepEqual(await menuTexts(t), menu);
        await t.close();
      }
    });

    it("the menu keeps you in the same view: history dates -> a day -> a person stays in the age manager demo", async () => {
      const t = await open(browser, site, "/demo-am/history.html");
      await t.page.waitForSelector("#dateList a");
      await t.page.click("#dateList a:has-text('2025-08-12')");
      await t.page.waitForSelector("#recordsTable a:has-text('Alice Smith')");
      await t.page.click("#recordsTable a:has-text('Alice Smith')");
      await t.page.waitForSelector("#message:has-text('History for Alice Smith')");
      assert.deepEqual(await menuTexts(t), ["DEMO-A", "S-in/S-out", "live", "history"]);
      await expectClean(t);
      await t.close();
    });
  });

  describe("the 404 page (what CloudFront shows for any address that does not exist)", () => {
    for (const url of ["/no/such/deep/page"]) {
      it(`${url} is styled, has the menu, and its links work`, async () => {
        const t = await open(browser, site, url, { expectNavigationStatus: 404 });
        await t.page.waitForSelector(".menu-header");
        assert.equal(await t.page.textContent("h1"), "Page not found");
        // both stylesheets and the favicon load from the site root, whatever the depth of the missing address
        const sheets = await t.page.evaluate(() => [...document.styleSheets].map((s) => new URL(s.href).pathname));
        assert.deepEqual(sheets, ["/vendor/picnic.min.css", "/sign-in-out.css"]);
        assert.equal(new URL(await t.page.locator("link[rel=icon]").evaluate((l) => l.href)).pathname, "/faviconV2.png");
        assert.equal(await t.page.evaluate(() => getComputedStyle(document.body).display), "flex"); // sign-in-out.css applied
        assert.deepEqual(await menuTexts(t), ["YOUTH", "sign", "live", "history"]);
        await expectClean(t); // no CSP violation, and no 404 for any asset
        await t.page.click(".menu-header a:has-text('history')");
        await t.page.waitForURL(`${site.url}/history.html`);
        await t.close();
      });
    }
  });

  describe("loading the menu", () => {
    it("a menu file that is missing is not pasted into the page (CloudFront answers it with the whole 404 page)", async () => {
      const t = await open(browser, site, "/info.html");
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
  });

  describe("every menu fits the screen", () => {
    const menus = [["youth", "/index.html"], ["age manager", "/am/index.html"], ["demo", "/demo/index.html?test=in"], ["demo age manager", "/demo-am/index.html?test=in"]];
    for (const width of [320]) {
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
