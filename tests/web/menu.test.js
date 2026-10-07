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
  // One check over all four menus. After a menu edit this catches a link to a page that does not exist, and the
  // menu-switching bug (a link without ?source= makes the next page show the wrong menu).
  it("every link goes to a page that exists in the same site, and the live / history / about links carry that menu's source", () => {
    const problems = [];
    for (const site of sites) {
      for (const [file, source] of Object.entries(snippets)) {
        const links = hrefsOf(fs.readFileSync(path.join(WEB, site, file), "utf8"));
        if (!links.some((h) => h.startsWith("./about.html"))) problems.push(`${site}/${file} has no link to the about page`);
        for (const href of links) {
          const target = path.join(WEB, site, href.replace(/^\.\//, "").split(/[?#]/)[0]);
          if (!fs.existsSync(target)) problems.push(`${site}/${file} links to ${href}, but ${path.relative(WEB, target)} does not exist (run ./scripts/build-sites.sh)`);
          if (/^\.\/(live|history|about)\.html/.test(href) && !href.includes(`source=${source}`)) problems.push(`${href} in ${site}/${file} should say source=${source}`);
        }
      }
    }
    assert.deepEqual(problems, []);
  });
});

describe("about page (menu-only page shared by youth and demo)", () => {
  const menu = (page) => [...page.document.querySelectorAll(".menu-header > div")].map((d) => d.textContent);

  it("youth: public menu by default", async () => {
    const page = await loadPage("main/about.html");
    await until(() => page.document.querySelector(".menu-header"), "menu");
    assert.deepEqual(menu(page), ["YOUTH", "sign", "live", "history", "about"]);
    assert.deepEqual(page.errors, []);
    page.close();
  });

  it("youth: leader menu with ?source=leader", async () => {
    const page = await loadPage("main/about.html", { query: "?source=leader" });
    await until(() => page.document.querySelector(".menu-header"), "menu");
    assert.deepEqual(menu(page), ["AM", "sign", "live", "history", "about"]);
    page.close();
  });

  it("demo: the demo menus, and the demo favicon (the page is generated per site)", async () => {
    const user = await loadPage("demo/about.html");
    await until(() => user.document.querySelector(".menu-header"), "menu");
    assert.deepEqual(menu(user), ["DEMO", "in/out", "live", "about"]);
    assert.equal(user.document.querySelector("link[rel=icon]").getAttribute("href"), "favicon-demo.png");
    user.close();

    const leader = await loadPage("demo/about.html", { query: "?source=leader" });
    await until(() => leader.document.querySelector(".menu-header"), "menu");
    assert.deepEqual(menu(leader), ["DEMO", "S-in/S-out", "live", "history", "about"]);
    leader.close();
  });

});
