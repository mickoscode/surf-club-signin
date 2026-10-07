const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { XSS, until, reply, loadPage, submit } = require("./helpers");
const { readApi } = require("./fixtures");

describe("live page", () => {
  it("loads names and the day's logs for the activity without errors", async () => {
    const page = await loadPage("demo/live.html", { query: "?test=in", api: readApi });
    await until(() => page.calls.some((c) => c.url.includes("/log?")), "log request");
    assert.ok(page.calls.some((c) => c.url.includes("activity_id=demo")));
    assert.deepEqual(page.errors, []);
    page.close();
  });

  it("keeps the menu it was reached from: the youth menu with ?source=user, otherwise the age manager menu", async () => {
    // both menus read "sign, live, history, about"; what differs is where "sign" goes
    const signGoesTo = async (query) => {
      const page = await loadPage("main/live.html", { query, api: readApi });
      await until(() => page.document.querySelector(".menu-header"), "menu");
      const labels = [...page.document.querySelectorAll(".menu-header a")].map((a) => a.textContent);
      const href = page.document.querySelector(".menu-header a").getAttribute("href");
      page.close();
      assert.deepEqual(labels, ["sign", "live", "history", "about"]);
      return href;
    };
    assert.equal(await signGoesTo("?source=user"), "./index.html");
    assert.equal(await signGoesTo(""), "./bulk.html");
  });
});
