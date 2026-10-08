const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { until, loadPage } = require("./helpers");

const DIST = path.resolve(__dirname, "..", "..", "dist"); // the assembled site: where the menu links must land

// Each view has one menu. Where the view is served in dist, the menu's label (a link to the view's info page), its
// menu items, and the tab icon its pages use. 
const views = {
  youth: { dir: DIST, label: "YOUTH", items: ["sign", "live", "history"], icon: "faviconV2.png", pages: ["index.html", "info.html"] },
  am: { dir: path.join(DIST, "am"), label: "AM", items: ["sign", "live", "history"], icon: "favicon-am.png", pages: ["index.html", "info.html"] },
  demo: { dir: path.join(DIST, "demo"), label: "DEMO-Y", items: ["in/out", "live", "history"], icon: "favicon-demo.png", pages: ["index.html", "info.html"] },
  "demo-am": { dir: path.join(DIST, "demo-am"), label: "DEMO-A", items: ["S-in/S-out", "live", "history"], icon: "favicon-demo.png", pages: ["index.html", "info.html"] },
};

const hrefsOf = (html) => [...html.matchAll(/<a\s+href="([^"]+)"/g)].map((m) => m[1]);

describe("menus", () => {
  // After a menu edit this catches a link to a page that does not exist in that view.
  it("every link in each view's menu goes to a page that exists in that view", () => {
    const problems = [];
    for (const [name, view] of Object.entries(views)) {
      const links = hrefsOf(fs.readFileSync(path.join(view.dir, "header.snippet"), "utf8"));
      if (links.length < 4) problems.push(`${name}/header.snippet has only ${links.length} links`);
      if (links[0] !== "./info.html") problems.push(`${name}/header.snippet: the label should link to ./info.html, not ${links[0]}`);
      for (const href of links) {
        const target = path.join(view.dir, href.replace(/^\.\//, "").split(/[?#]/)[0]);
        if (!fs.existsSync(target)) problems.push(`${name}/header.snippet links to ${href}, but ${path.relative(DIST, target)} does not exist in dist (run ./scripts/build-sites.sh)`);
      }
    }
    assert.deepEqual(problems, []);
  });

  it("each view shows its own menu and tab icon, on every kind of page: working, live, history and info", async () => {
    for (const [name, view] of Object.entries(views)) {
      for (const file of [...view.pages, "live.html", "history.html"]) {
        const page = await loadPage(path.relative(DIST, path.join(view.dir, file)));
        await until(() => page.document.querySelector(".menu-header"), `${name}/${file} menu`);
        const texts = [...page.document.querySelectorAll(".menu-header > div")].map((d) => d.textContent);
        assert.deepEqual(texts, [view.label, ...view.items], `${name}/${file}`);
        assert.equal(page.document.querySelector("link[rel=icon]").getAttribute("href"), view.icon, `${name}/${file}`);
        assert.deepEqual(page.errors, []);
        page.close();
      }
    }
  });
});
