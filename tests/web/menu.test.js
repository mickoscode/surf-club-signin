const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { until, loadPage } = require("./helpers");

const DIST = path.resolve(__dirname, "..", "..", "dist"); // the assembled site: where the menu links must land

// Each view has one menu. Where the view is served in dist, the menu's label (a link back to the view's guide), its
// menu items, and the tab icon its pages use. Youth's label is plain text.
const views = {
  youth: { dir: DIST, label: "YOUTH", items: ["sign", "live", "history", "about"], icon: "faviconV2.png", pages: ["index.html", "about.html"] },
  am: { dir: path.join(DIST, "am"), label: "AM", items: ["sign", "live", "history", "about"], icon: "favicon-am.png", pages: ["index.html", "bulk.html"] },
  demo: { dir: path.join(DIST, "demo"), label: "DEMO-Y", items: ["in/out", "live", "about"], icon: "favicon-demo.png", pages: ["guide.html", "index.html"] },
  "demo-am": { dir: path.join(DIST, "demo-am"), label: "DEMO-A", items: ["S-in/S-out", "live", "history", "about"], icon: "favicon-demo.png", pages: ["index.html", "bulk.html"] },
};

const hrefsOf = (html) => [...html.matchAll(/<a\s+href="([^"]+)"/g)].map((m) => m[1]);

describe("menus", () => {
  // After a menu edit this catches a link to a page that does not exist in that view.
  it("every link in each view's menu goes to a page that exists in that view", () => {
    const problems = [];
    for (const [name, view] of Object.entries(views)) {
      const links = hrefsOf(fs.readFileSync(path.join(view.dir, "header.snippet"), "utf8"));
      if (links.length < 4) problems.push(`${name}/header.snippet has only ${links.length} links`);
      for (const href of links) {
        const target = path.join(view.dir, href.replace(/^\.\//, "").split(/[?#]/)[0]);
        if (!fs.existsSync(target)) problems.push(`${name}/header.snippet links to ${href}, but ${path.relative(DIST, target)} does not exist in dist (run ./scripts/build-sites.sh)`);
      }
    }
    assert.deepEqual(problems, []);
  });

  it("each view shows its own menu and tab icon, on its generated pages and on its own guide", async () => {
    for (const [name, view] of Object.entries(views)) {
      for (const file of [...view.pages, "about.html"]) {
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
