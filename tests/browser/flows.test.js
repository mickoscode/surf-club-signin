const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, policy } = require("./server");
const { launch, open, expectClean } = require("./helpers");

// The things a person actually does, in real Chromium under the enforced policy: after each flow there must be
// no CSP violation, no script error and no failed request, and the page must have done the right thing.
describe("user flows under the enforced policy", () => {
  let site, browser;
  before(async () => { site = await startServer(); browser = await launch(); });
  after(async () => { await browser.close(); await site.close(); });

  const posts = (t) => t.calls.filter((c) => c.method === "POST");

  describe("sign in / sign out", () => {
    async function pickAlice(t) {
      await t.page.waitForSelector("#signForm:not(.hidden)");
      await t.page.fill("#nameInput", "ali");
      await t.page.click(".dropdown-item");
    }

    it("type a name, pick it, sign in", async () => {
      const t = await open(browser, site, "/demo/index.html?test=in");
      await pickAlice(t);
      await t.page.click("#submitButton");
      await t.page.waitForSelector("#message:has-text('Alice Smith has signed in')");
      assert.equal(await t.page.isDisabled("#submitButton"), true);
      assert.deepEqual(posts(t).map((c) => [c.url.replace(policy.apiUrl, ""), c.body.name_id, c.body.direction, c.body.activity_id]),
        [["/log", "alice", "in", "demo"]]);
      await expectClean(t);
      await t.close();
    });

  });

  describe("leaders", () => {
    it("bulk sign-in: choose a group, tick a name, submit", async () => {
      const t = await open(browser, site, "/demo-am/bulk.html?test=in");
      await t.page.waitForSelector("#bulkForm:not(.hidden)");
      assert.deepEqual(await t.page.locator("#filterButtons button").allTextContents(), ["All", "u14", "u15"]);
      await t.page.click("#filterButtons button:has-text('u14')");
      await t.page.check(".name-toggle");
      await t.page.click("#bulkSubmitButton");
      await t.page.waitForSelector("#message:has-text('Bulk submission completed')");
      const [post] = posts(t);
      assert.equal(post.url, `${policy.apiUrl}/bulk`);
      assert.deepEqual([post.body.activity_id, post.body.direction, post.body.name_id_list], ["demo", "in", ["bob"]]);
      await expectClean(t);
      await t.close();
    });

    it("history: dates -> a day -> a person", async () => {
      const t = await open(browser, site, "/demo-am/history.html");
      await t.page.click("#dateList a:has-text('2025-08-12')");
      await t.page.waitForSelector("#recordsTable a:has-text('Alice Smith')");
      await t.page.click("#recordsTable a:has-text('Alice Smith')");
      await t.page.waitForSelector("#message:has-text('History for Alice Smith')");
      await t.page.waitForSelector("#recordsTable tr:has(td)");
      await expectClean(t);
      await t.close();
    });

  });

  describe("admin pages (web/data)", () => {
    it("add a name", async () => {
      const t = await open(browser, site, "/data/names.html");
      await t.page.waitForSelector("#addForm");
      await t.page.fill("#addForm [name=display]", "Test Person");
      await t.page.click("#addForm button");
      await t.page.waitForSelector("#message:has-text('Name added successfully')");
      const [post] = posts(t);
      assert.equal(post.url, `${policy.apiUrl}/addname`);
      assert.equal(post.body.display, "Test Person");
      await expectClean(t);
      await t.close();
    });

    it("edit a name from the list", async () => {
      const t = await open(browser, site, "/data/names.html");
      await t.page.click("ul li a >> nth=0");
      await t.page.waitForSelector("#editForm");
      await t.page.fill("#editForm [name=display]", "Alice Jones");
      await t.page.click("#editForm button");
      await t.page.waitForURL(/\/data\/names\.html$/);
      const edit = t.calls.find((c) => c.url.endsWith("/editname"));
      assert.deepEqual([edit.body.name_id, edit.body.display], ["alice", "Alice Jones"]);
      await expectClean(t);
      await t.close();
    });

    it("login stub: Log Out is hidden, Log In redirects to the Auth0 tenant", async () => {
      const t = await open(browser, site, "/data/index.html");
      await t.page.waitForSelector("#login");
      assert.equal(await t.page.isVisible("#logout"), false);
      const redirect = t.page.waitForRequest((r) => r.url().startsWith(`https://${policy.auth0Domain}/authorize`), { timeout: 5000 });
      await t.page.click("#login");
      await redirect;
      await t.close();
    });
  });
});
