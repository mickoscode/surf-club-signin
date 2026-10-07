const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { XSS, until, reply, loadPage, submit, addFormFieldShortcuts } = require("./helpers");
const { names, logs, readApi } = require("./fixtures");

describe("data/names.html (manage names)", () => {

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

// These pages used inline onclick/onsubmit attributes; they are now wired with addEventListener
// (inline handlers are blocked by the Content-Security-Policy).
describe("data pages: buttons and forms are wired up without inline handlers", () => {
  it("list-names: the Fetch Names button loads the names", async () => {
    const page = await loadPage("data/list-names.html", { query: "?activity_id=demo", api: readApi });
    assert.equal(page.document.querySelectorAll("#namesTable tbody tr").length, 0);
    page.document.getElementById("fetchNamesButton").click();
    await until(() => page.document.querySelectorAll("#namesTable tbody tr").length === names.length, "names table");
    assert.deepEqual(page.errors, []);
    page.close();
  });

  it("logs: the Fetch Logs button loads the day's logs", async () => {
    const page = await loadPage("data/logs.html", { query: "?date=2025-08-12", api: readApi });
    page.document.getElementById("fetchLogsButton").click();
    await until(() => page.document.querySelectorAll("#logTable tbody tr").length === logs.length, "logs table");
    page.close();
  });

  it("logs: submitting the form posts the log, shows the result and refreshes the table", async () => {
    const api = (url, init) => (init.method === "POST" ? reply(201, { message: "Log added." }) : readApi(url));
    const page = await loadPage("data/logs.html", { query: "?date=2025-08-12", api });
    const form = page.document.getElementById("addLogForm");
    addFormFieldShortcuts(form); // submitLog reads form.name_id etc., as browsers allow
    form.elements.name_id.value = "alice";
    form.elements.direction.value = "out";
    form.elements.date_time.value = "2025-08-12T09:40:00Z";
    submit(page, form);
    await until(() => page.document.getElementById("message").textContent === "Log added.", "message");
    const post = page.calls.find((c) => c.method === "POST");
    assert.deepEqual(post.body, {
      activity_id: "sorrento_youth_sunday",
      name_id: "alice",
      direction: "out",
      date_time: "2025-08-12T09:40:00Z",
    });
    await until(() => page.document.querySelectorAll("#logTable tbody tr").length === logs.length, "refreshed table");
    page.close();
  });

});
