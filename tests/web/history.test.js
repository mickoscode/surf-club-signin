const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { XSS, until, loadPage } = require("./helpers");
const { readApi } = require("./fixtures");

describe("history page", () => {
  it("lists dates as links, newest first", async () => {
    const api = (url) => (url.includes("/date?") ? { dates: ["2025-08-10", "2025-08-12", "2025-08-11"] } : readApi(url));
    const page = await loadPage("demo-am/history.html", { api });
    await until(() => page.document.querySelectorAll("#dateList a").length === 3, "date links");
    const shown = [...page.document.querySelectorAll("#dateList a")].map((a) => a.textContent);
    assert.deepEqual(shown, ["2025-08-12", "2025-08-11", "2025-08-10"]);
    page.close();
  });

  it("day view: one row per person who signed, linking to their history", async () => {
    const page = await loadPage("demo-am/history.html", { query: "?date=2025-08-12", api: readApi });
    const anchors = await until(() => {
      const found = page.document.querySelectorAll("#recordsTable a");
      return found.length === 2 && found;
    }, "name links");
    assert.equal(anchors[0].textContent, "Alice Smith");
    assert.equal(anchors[0].getAttribute("href"), "./history.html?name_id=alice");
    assert.equal(page.document.getElementById("message").textContent, "2025-08-12");
    page.close();
  });

  it("day view: a name containing HTML is shown as text, not turned into elements", async () => {
    const page = await loadPage("demo-am/history.html", { query: "?date=2025-08-12", api: readApi });
    await until(() => page.document.querySelectorAll("#recordsTable a").length === 2, "name links");
    const evil = page.document.querySelectorAll("#recordsTable a")[1];
    assert.equal(evil.textContent, XSS);
    assert.equal(page.document.querySelectorAll("#recordsTable img").length, 0);
    assert.deepEqual(page.errors, []);
    page.close();
  });

  it("ignores a malformed date parameter and shows the date list instead", async () => {
    const page = await loadPage("demo-am/history.html", { query: "?date=<script>", api: readApi });
    await until(() => page.document.querySelectorAll("#dateList a").length === 2, "date links");
    assert.equal(page.document.getElementById("message").textContent, "History available");
    page.close();
  });

  it("person view: heading and one row per day with in/out times", async () => {
    const page = await loadPage("demo-am/history.html", { query: "?name_id=alice", api: readApi });
    await until(() => page.document.getElementById("message").textContent === "History for Alice Smith", "heading");
    const cells = await until(() => {
      const found = [...page.document.querySelectorAll("#recordsTable tr td")];
      return found.length === 3 && found;
    }, "history row");
    assert.equal(cells[0].textContent, "2025-08-12");
    assert.match(cells[1].textContent, /^\d\d:\d\d$/);
    assert.match(cells[2].textContent, /^\d\d:\d\d$/);
    page.close();
  });

  it("person view: unknown name says so; malformed name_id is ignored", async () => {
    const unknown = await loadPage("demo-am/history.html", { query: "?name_id=nobody", api: readApi });
    await until(() => unknown.document.getElementById("message").textContent === "Name not found", "not found");
    unknown.close();

    const bad = await loadPage("demo-am/history.html", { query: "?name_id=../etc", api: readApi });
    await until(() => bad.document.getElementById("message").textContent === "History available", "date list fallback");
    bad.close();
  });
});
