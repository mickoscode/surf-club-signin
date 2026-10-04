const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { XSS, until, loadPage } = require("./helpers");
const { names, logs, readApi } = require("./fixtures");

describe("data/names.html (manage names)", () => {
  it("add form has every activity and filter, a 50 character limit and an Add button", async () => {
    const page = await loadPage("data/names.html", { api: readApi });
    const form = await until(() => page.document.getElementById("addForm"), "add form");
    assert.equal(form.elements.activity_id.options.length, 10);
    assert.equal(form.elements.filter.options.length, 8);
    assert.equal(form.elements.display.maxLength, 50);
    assert.equal(form.querySelector("button").textContent, "Add");
    page.close();
  });

  it("links each existing name to its edit form, URL-encoded, with names as text", async () => {
    const page = await loadPage("data/names.html", { api: readApi });
    const links = await until(() => {
      const found = page.document.querySelectorAll("ul li a");
      return found.length === names.length && found;
    }, "name links");
    assert.equal(links[0].getAttribute("href"), "./names.html?activity_id=demo&name_id=alice&filter=u14");
    assert.ok(links[1].textContent.includes(XSS));
    assert.equal(page.document.querySelectorAll("ul img").length, 0);
    page.close();
  });

  it("edit form is filled from the URL and API, and hostile values stay inert", async () => {
    const hostileFilter = 'u14"><img src=x onerror="window.__xss=1">';
    const hostileDisplay = '"><b id="pwn">hi</b>';
    const api = (url) => (url.includes("/name?") ? { names: [{ display: hostileDisplay }] } : {});
    const page = await loadPage("data/names.html", {
      query: `?activity_id=demo&name_id=x&filter=${encodeURIComponent(hostileFilter)}`,
      api,
    });
    const form = await until(() => page.document.getElementById("editForm"), "edit form");
    assert.equal(page.document.querySelectorAll("img").length, 0);
    assert.equal(page.document.getElementById("pwn"), null);
    assert.equal(form.elements.name_id.value, "x");
    assert.equal(form.elements.activity_id.value, "demo");
    assert.equal(form.elements.display.value, hostileDisplay);
    assert.equal(form.elements.display.maxLength, 50);
    assert.equal(form.querySelector("button").textContent, "Update");
    // the hostile filter was URL-encoded in the API request
    assert.ok(page.calls[0].url.includes("filter=u14%22%3E%3Cimg"));
    assert.deepEqual(page.errors, []);
    page.close();
  });
});

describe("data/list-names.html", () => {
  it("renders every name as text in three cells", async () => {
    const page = await loadPage("data/list-names.html", { query: "?activity_id=demo", api: readApi });
    await page.window.fetchNames();
    const rows = page.document.querySelectorAll("#namesTable tbody tr");
    assert.equal(rows.length, names.length);
    assert.ok([...rows].every((r) => r.children.length === 3));
    assert.ok([...page.document.querySelectorAll("#namesTable td")].some((td) => td.textContent === XSS));
    assert.equal(page.document.querySelectorAll("#namesTable img").length, 0);
    page.close();
  });
});

describe("data/logs.html", () => {
  it("renders every log as text", async () => {
    const page = await loadPage("data/logs.html", { query: "?date=2025-08-12", api: readApi });
    await page.window.fetchLogs();
    assert.equal(page.document.querySelectorAll("#logTable tbody tr").length, logs.length);
    assert.equal(page.document.querySelectorAll("#logTable img").length, 0);
    page.close();
  });
});
