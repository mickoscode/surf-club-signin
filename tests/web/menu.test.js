const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { until, loadPage } = require("./helpers");

const WEB = path.resolve(__dirname, "..", "..", "web");

// The two menu files each site has, and what they must contain.
const sites = ["main", "demo"];
const snippets = { "header.snippet": "user", "header_leader.snippet": "leader" };

const hrefsOf = (html) => [...html.matchAll(/<a\s+href="([^"]+)"/g)].map((m) => m[1]);

describe("menu files", () => {
  for (const site of sites) {
    for (const [file, source] of Object.entries(snippets)) {
      const html = fs.readFileSync(path.join(WEB, site, file), "utf8");

      it(`${site}/${file}: every link goes to a page that exists in the same site`, () => {
        for (const href of hrefsOf(html)) {
          const target = path.join(WEB, site, href.replace(/^\.\//, "").split(/[?#]/)[0]);
          assert.ok(fs.existsSync(target), `${site}/${file} links to ${href}, but ${path.relative(WEB, target)} does not exist (run ./scripts/build-sites.sh)`);
        }
      });

      it(`${site}/${file}: history and about links carry source=${source}, so the menu survives the click`, () => {
        const links = hrefsOf(html);
        for (const page of ["history.html", "about.html"]) {
          const found = links.filter((h) => h.startsWith(`./${page}`));
          for (const href of found) assert.ok(href.includes(`source=${source}`), `${href} in ${site}/${file} should say source=${source}`);
        }
        assert.ok(links.some((h) => h.startsWith("./about.html")), "every menu links to the about page");
      });

      it(`${site}/${file}: is a labelled navigation region with exactly one site label`, () => {
        assert.match(html, /role="navigation"/);
        assert.match(html, /aria-label="[^"]+"/);
        assert.equal((html.match(/class="menu-left"/g) || []).length, 1);
      });
    }
  }

  it("the site label says which site it is", () => {
    assert.match(fs.readFileSync(path.join(WEB, "main", "header.snippet"), "utf8"), />YOUTH</);
    assert.match(fs.readFileSync(path.join(WEB, "demo", "header.snippet"), "utf8"), />DEMO</);
  });
});

describe("about page (menu-only page shared by youth and demo)", () => {
  const menu = (page) => [...page.document.querySelectorAll(".menu-header > div")].map((d) => d.textContent);

  it("youth: public menu by default", async () => {
    const page = await loadPage("main/about.html");
    await until(() => page.document.querySelector(".menu-header"), "menu");
    assert.deepEqual(menu(page), ["YOUTH", "sign", "history", "about"]);
    assert.deepEqual(page.errors, []);
    page.close();
  });

  it("youth: leader menu with ?source=leader", async () => {
    const page = await loadPage("main/about.html", { query: "?source=leader" });
    await until(() => page.document.querySelector(".menu-header"), "menu");
    assert.deepEqual(menu(page), ["YOUTH", "sign", "live", "history", "about"]);
    page.close();
  });

  it("demo: the demo menus, and the demo favicon (the page is generated per site)", async () => {
    const user = await loadPage("demo/about.html");
    await until(() => user.document.querySelector(".menu-header"), "menu");
    assert.deepEqual(menu(user), ["DEMO", "in/out", "about"]);
    assert.equal(user.document.querySelector("link[rel=icon]").getAttribute("href"), "favicon-test.png");
    user.close();

    const leader = await loadPage("demo/about.html", { query: "?source=leader" });
    await until(() => leader.document.querySelector(".menu-header"), "menu");
    assert.deepEqual(menu(leader), ["DEMO", "S-in/S-out", "live", "history", "about"]);
    leader.close();
  });

  it("an unknown ?source= value falls back to the public menu", async () => {
    const page = await loadPage("main/about.html", { query: "?source=admin" });
    await until(() => page.document.querySelector(".menu-header"), "menu");
    assert.equal(menu(page)[1], "sign");
    page.close();
  });

  it("the menu has somewhere to go back to: the about links keep the page's own source", async () => {
    const page = await loadPage("main/about.html", { query: "?source=leader" });
    await until(() => page.document.querySelector(".menu-header"), "menu");
    const hrefs = [...page.document.querySelectorAll(".menu-header a")].map((a) => a.getAttribute("href"));
    assert.ok(hrefs.includes("./about.html?source=leader"), JSON.stringify(hrefs));
    page.close();
  });
});
