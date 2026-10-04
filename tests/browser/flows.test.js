const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, policy } = require("./server");
const { launch, open, expectClean, reply, defaultApi } = require("./helpers");
const { XSS } = require("../web/helpers");
const { readApi } = require("../web/fixtures");

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

    it("sign out uses the out window", async () => {
      const t = await open(browser, site, "/demo/index.html?test=out");
      await pickAlice(t);
      await t.page.click("#submitButton");
      await t.page.waitForSelector("#message:has-text('Alice Smith has signed out')");
      assert.equal(posts(t)[0].body.direction, "out");
      await expectClean(t);
      await t.close();
    });

    it("remembers the name next time, and Clear Name forgets it", async () => {
      const t = await open(browser, site, "/demo/index.html?test=in");
      await pickAlice(t);
      await t.page.click("#submitButton");
      await t.page.waitForSelector("#message:has-text('has signed in')");
      await t.page.reload();
      await t.page.waitForSelector("#signForm:not(.hidden)");
      assert.equal(await t.page.inputValue("#nameInput"), "Alice Smith");
      await t.page.click("#clearName");
      assert.equal(await t.page.inputValue("#nameInput"), "");
      await expectClean(t);
      await t.close();
    });

    it("a name containing HTML is shown as text and nothing runs", async () => {
      const t = await open(browser, site, "/demo/index.html?test=in");
      await t.page.waitForSelector("#signForm:not(.hidden)");
      await t.page.fill("#nameInput", "img");
      await t.page.waitForSelector(".dropdown-item");
      assert.equal(await t.page.textContent(".dropdown-item"), XSS);
      assert.equal(await t.page.locator(".dropdown img").count(), 0);
      assert.equal(await t.page.evaluate(() => window.__xss), undefined);
      await expectClean(t);
      await t.close();
    });

    it("special characters typed into the name box do not break it", async () => {
      const t = await open(browser, site, "/demo/index.html?test=in");
      await t.page.waitForSelector("#signForm:not(.hidden)");
      for (const typed of ["(", "[", "\\", "b) ["]) {
        await t.page.fill("#nameInput", typed);
        await t.page.waitForTimeout(400);
      }
      assert.equal(await t.page.textContent(".dropdown-item"), "Bob (b) [x]");
      await expectClean(t);
      await t.close();
    });

    it("a throttled API (429) shows a friendly message in an alert", async () => {
      const api = (url, init) => (init.method === "POST" ? reply(429, { message: "Too Many Requests" }) : readApi(url));
      const t = await open(browser, site, "/demo/index.html?test=in", { api });
      await pickAlice(t);
      await t.page.click("#submitButton");
      await t.page.waitForFunction(() => document.getElementById("submitButton").disabled === false);
      await t.page.waitForTimeout(200);
      assert.match(t.watch.dialogs.join("|"), /Too many requests right now/);
      await expectClean(t);
      await t.close();
    });
  });

  describe("leaders", () => {
    it("bulk sign-in: choose a group, tick a name, submit", async () => {
      const t = await open(browser, site, "/demo/bulk.html?test=in");
      await t.page.waitForSelector("#bulkForm:not(.hidden)");
      assert.deepEqual(await t.page.locator("#filterButtons button").allTextContents(), ["All", "u14", "u15"]);
      await t.page.click("#filterButtons button:has-text('u14')");
      await t.page.check(".name-toggle");
      await t.page.click("#bulkSubmitButton");
      await t.page.waitForSelector("#message:has-text('Bulk Submission Completed')");
      const [post] = posts(t);
      assert.equal(post.url, `${policy.apiUrl}/bulk`);
      assert.deepEqual([post.body.activity_id, post.body.direction, post.body.name_id_list], ["demo", "in", ["bob"]]);
      await expectClean(t);
      await t.close();
    });

    it("bulk sign-in: a failed submission can be retried with the same timestamp", async () => {
      let attempt = 0;
      const api = (url, init) => (init.method === "POST" ? (++attempt === 1 ? reply(500, { message: "Internal server error" }) : reply(201, { written: 1, skipped: [] })) : readApi(url));
      const t = await open(browser, site, "/demo/bulk.html?test=in", { api });
      await t.page.waitForSelector("#bulkForm:not(.hidden)");
      await t.page.click("#filterButtons button:has-text('u14')");
      await t.page.check(".name-toggle");
      await t.page.click("#bulkSubmitButton");
      await t.page.waitForSelector("#message:has-text('Bulk submission failed: Internal server error')");
      assert.equal(await t.page.isDisabled("#bulkSubmitButton"), false);
      await t.page.click("#bulkSubmitButton");
      await t.page.waitForSelector("#message:has-text('Bulk Submission Completed')");
      const [first, second] = posts(t);
      assert.equal(first.body.date_time, second.body.date_time);
      assert.match(t.watch.dialogs.join("|"), /Internal server error/);
      await expectClean(t);
      await t.close();
    });

    it("live counter shows how many are currently signed in", async () => {
      const t = await open(browser, site, "/demo/live.html?test=in");
      await t.page.waitForSelector("#recordsTable tr:has(td)");
      assert.equal(await t.page.textContent("#liveTotal"), "1"); // alice in+out, evil in => 2 in, 1 out
      await t.page.click("#filterButtons button:has-text('u15')");
      assert.equal(await t.page.locator("#recordsTable tr:has(td):not(.hidden)").count(), 1);
      await expectClean(t);
      await t.close();
    });

    it("history: dates -> a day -> a person", async () => {
      const t = await open(browser, site, "/demo/history.html");
      await t.page.click("#dateList a:has-text('2025-08-12')");
      await t.page.waitForSelector("#recordsTable a:has-text('Alice Smith')");
      await t.page.click("#recordsTable a:has-text('Alice Smith')");
      await t.page.waitForSelector("#message:has-text('History for Alice Smith')");
      await t.page.waitForSelector("#recordsTable tr:has(td)");
      await expectClean(t);
      await t.close();
    });

    it("the age-manager page links to every group's pages", async () => {
      const t = await open(browser, site, "/age-manager/");
      const links = await t.page.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      assert.ok(links.includes("../pink/bulk.html") && links.includes("../red/index.html"), JSON.stringify(links));
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
      await t.page.waitForSelector("#message:has-text('name added successfully')");
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

    it("list names and list logs", async () => {
      const names = await open(browser, site, "/data/list-names.html?activity_id=demo");
      await names.page.click("#fetchNamesButton");
      await names.page.waitForSelector("#namesTable tbody tr");
      assert.equal(await names.page.locator("#namesTable tbody tr").count(), 3);
      await expectClean(names);
      await names.close();

      const logs = await open(browser, site, "/data/logs.html?date=2025-08-12");
      await logs.page.click("#fetchLogsButton");
      await logs.page.waitForSelector("#logTable tbody tr");
      await logs.page.fill("#name_id", "alice");
      await logs.page.fill("#date_time", "2025-08-12T09:40:00Z");
      await logs.page.selectOption("#direction", "out");
      await logs.page.click("#addLogForm button");
      await logs.page.waitForSelector("#message:has-text('ok')");
      assert.equal(logs.calls.find((c) => c.method === "POST").body.direction, "out");
      await expectClean(logs);
      await logs.close();
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
