const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { XSS, until, reply, loadPage, submit, addFormFieldShortcuts } = require("./helpers");
const { names, logs, readApi } = require("./fixtures");

const DATA = path.resolve(__dirname, "..", "..", "web", "data");
const PAGES = ["index.html", "names.html", "list-names.html", "logs.html"];
const parse = (file) => new JSDOM(fs.readFileSync(path.join(DATA, file), "utf8")).window.document;

describe("data admin pages: one consistent menu", () => {
  const menuHtml = (doc) => doc.querySelector(".menu-header").outerHTML.replace(/\s+aria-current="page"/g, "");

  it("every page has the same menu (markup identical apart from which link is current)", () => {
    const menus = PAGES.map((file) => menuHtml(parse(file)));
    for (const [i, menu] of menus.entries()) assert.equal(menu, menus[0], `${PAGES[i]} has a different menu`);
  });

  it("the menu is a labelled navigation region that names every page", () => {
    const menu = parse("index.html").querySelector(".menu-header");
    assert.equal(menu.getAttribute("role"), "navigation");
    assert.ok(menu.getAttribute("aria-label"));
    assert.deepEqual([...menu.querySelectorAll("a")].map((a) => a.getAttribute("href")), PAGES.map((f) => `./${f}`));
  });

  for (const file of PAGES) {
    it(`${file} marks itself as the current page in the menu, and only itself`, () => {
      const current = [...parse(file).querySelectorAll('.menu-header a[aria-current="page"]')];
      assert.equal(current.length, 1);
      assert.equal(current[0].getAttribute("href"), `./${file}`);
    });

    it(`${file} loads the site theme and the admin styles, and each file exists`, () => {
      const sheets = [...parse(file).querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute("href"));
      assert.deepEqual(sheets, ["vendor/picnic.min.css", "sign-in-out.css", "admin.css"]);
      for (const sheet of sheets) assert.ok(fs.existsSync(path.join(DATA, sheet)), `${sheet} is missing from web/data`);
    });

    it(`${file} has a language, a title naming the section, and one main region`, () => {
      const doc = parse(file);
      assert.equal(doc.documentElement.lang, "en");
      assert.match(doc.title, / - data admin$/);
      assert.equal(doc.querySelectorAll("main").length, 1);
      assert.equal(doc.querySelectorAll("h1").length, 1);
    });
  }
});

// Every form control must have a visible label tied to it (clicking the label focuses the control, and screen readers read it).
function unlabelled(document) {
  return [...document.querySelectorAll("input:not([type=hidden]), select, textarea")]
    .filter((c) => !c.id || !document.querySelector(`label[for="${c.id}"]`))
    .map((c) => c.name || c.id || c.tagName);
}

describe("data admin pages: forms are labelled", () => {
  it("logs: every field has a label", async () => {
    const page = await loadPage("data/logs.html", { api: readApi });
    assert.deepEqual(unlabelled(page.document), []);
    page.close();
  });

  it("names: the add form's fields have labels, hints are linked to their fields", async () => {
    const page = await loadPage("data/names.html", { api: readApi });
    await until(() => page.document.getElementById("addForm"), "add form");
    assert.deepEqual(unlabelled(page.document), []);
    const display = page.document.getElementById("field-display");
    assert.equal(page.document.getElementById(display.getAttribute("aria-describedby")).className, "hint");
    assert.equal(page.document.querySelector('label[for="field-activity_id"]').textContent, "Activity ID");
    page.close();
  });

  it("names: the edit form's fields have labels, with a way back to the list", async () => {
    const api = (url) => (url.includes("/name?") ? { names: [{ display: "Alice Smith" }] } : {});
    const page = await loadPage("data/names.html", { query: "?activity_id=demo&name_id=alice&filter=u14", api });
    await until(() => page.document.getElementById("editForm"), "edit form");
    assert.deepEqual(unlabelled(page.document), []);
    assert.equal(page.document.querySelector(".back-link").getAttribute("href"), "./names.html");
    assert.match(page.document.getElementById("field-display-hint").textContent, /Name ID: alice/);
    page.close();
  });
});

describe("data admin pages: status and structure", () => {
  it("status messages are announced to screen readers (role=status) and hidden while empty", () => {
    for (const file of ["names.html", "logs.html"]) {
      const message = parse(file).getElementById("message");
      assert.equal(message.getAttribute("role"), "status");
      assert.equal(message.textContent, "");
    }
  });

  it("names: after adding, the message appears in the status area; hostile names stay inert in the list", async () => {
    const api = (url, init) => (init.method === "POST" ? reply(201, { message: "ok" }) : readApi(url));
    const page = await loadPage("data/names.html", { api });
    const form = await until(() => page.document.getElementById("addForm"), "add form");
    await until(() => page.document.querySelector(".name-list li"), "name list");
    addFormFieldShortcuts(form); // the page reads form.display etc., as browsers allow
    submit(page, form);
    await until(() => page.document.getElementById("message").textContent === "name added successfully", "message");
    const rows = [...page.document.querySelectorAll(".name-list li a")];
    assert.equal(rows.length, names.length);
    assert.deepEqual([...rows[0].children].map((c) => c.className), ["name-main", "name-sub", "chip"]);
    assert.equal(rows[1].querySelector(".name-main").textContent, XSS);
    assert.equal(page.document.querySelectorAll(".name-list img").length, 0);
    const headings = [...page.document.querySelectorAll("h2")].map((h) => h.textContent);
    assert.ok(headings.includes("Existing names: sorrento_youth_sunday (3)"), JSON.stringify(headings));
    page.close();
  });

  it("names: the Existing names list is refreshed after a name is added (replaced, not duplicated)", async () => {
    const stored = [...names];
    const api = (url, init) => {
      if (init.method === "POST") {
        stored.push({ activity_id: "sorrento_youth_sunday", name_id: "new_kid", display: init.body.display, filter: init.body.filter });
        return reply(201, { message: "ok" });
      }
      return url.includes("/name?") ? { names: stored } : {};
    };
    const page = await loadPage("data/names.html", { api });
    const form = await until(() => page.document.getElementById("addForm"), "add form");
    await until(() => page.document.querySelectorAll(".name-list li").length === 3, "initial list");
    addFormFieldShortcuts(form);
    form.elements.display.value = "New Kid";
    submit(page, form);

    await until(() => page.document.querySelectorAll(".name-list li").length === 4, "refreshed list");
    assert.equal(page.document.querySelectorAll("#nameListSection").length, 1, "the old list must be replaced");
    assert.ok([...page.document.querySelectorAll(".name-list .name-main")].some((n) => n.textContent === "New Kid"));
    assert.ok([...page.document.querySelectorAll("h2")].some((h) => h.textContent === "Existing names: sorrento_youth_sunday (4)"));
    assert.equal(page.document.getElementById("message").textContent, "name added successfully");
    // one list fetch on load, one after adding
    assert.equal(page.calls.filter((c) => c.method === "GET" && c.url.includes("/name?")).length, 2);
    page.close();
  });

  it("names: if the refresh fails, the success message stays and the old list is kept", async () => {
    let failRefresh = false;
    const api = (url, init) => {
      if (init.method === "POST") { failRefresh = true; return reply(201, { message: "ok" }); }
      if (failRefresh) throw new Error("network down");
      return readApi(url);
    };
    const page = await loadPage("data/names.html", { api });
    const form = await until(() => page.document.getElementById("addForm"), "add form");
    await until(() => page.document.querySelectorAll(".name-list li").length === 3, "initial list");
    addFormFieldShortcuts(form);
    submit(page, form);
    await until(() => page.document.getElementById("message").textContent === "name added successfully", "message");
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(page.document.querySelectorAll(".name-list li").length, 3);
    assert.equal(page.document.querySelectorAll("#nameListSection").length, 1);
    page.close();
  });

  it("list-names: the table headings match the three columns it fills, and the current activity is marked", async () => {
    const page = await loadPage("data/list-names.html", { query: "?activity_id=sorrento_youth_sunday", api: readApi });
    const headings = [...page.document.querySelectorAll("#namesTable th")].map((th) => th.textContent);
    assert.deepEqual(headings, ["Display name", "Name ID", "Filter"]);
    const current = [...page.document.querySelectorAll('.admin-tabs a[aria-current="true"]')];
    assert.deepEqual(current.map((a) => a.textContent), ["youth"]);
    assert.match(page.document.getElementById("namesStatus").textContent, /Press Fetch Names/);

    page.document.getElementById("fetchNamesButton").click();
    await until(() => page.document.querySelectorAll("#namesTable tbody tr").length === names.length, "rows");
    assert.ok([...page.document.querySelectorAll("#namesTable tbody tr")].every((r) => r.children.length === headings.length));
    assert.equal(page.document.getElementById("namesStatus").textContent, `${names.length} names loaded for sorrento_youth_sunday.`);
    page.close();
  });

  it("list-names: defaults to youth; the demo tab is current for ?activity_id=demo; an unknown activity falls back to youth", async () => {
    const current = (page) => [...page.document.querySelectorAll('.admin-tabs a[aria-current="true"]')].map((a) => a.textContent);

    const none = await loadPage("data/list-names.html", { api: readApi });
    assert.equal(none.document.getElementById("activityName").textContent, "sorrento_youth_sunday");
    assert.deepEqual(current(none), ["youth"]);
    none.document.getElementById("fetchNamesButton").click();
    await until(() => none.calls.length > 0, "request");
    assert.ok(none.calls[0].url.includes("activity_id=sorrento_youth_sunday"), none.calls[0].url);
    none.close();

    const demo = await loadPage("data/list-names.html", { query: "?activity_id=demo", api: readApi });
    assert.equal(demo.document.getElementById("activityName").textContent, "demo");
    assert.deepEqual(current(demo), ["demo"]);
    demo.close();

    const unknown = await loadPage("data/list-names.html", { query: "?activity_id=nope", api: readApi });
    assert.equal(unknown.document.getElementById("activityName").textContent, "sorrento_youth_sunday");
    assert.deepEqual(current(unknown), ["youth"]);
    unknown.close();
  });

  it("logs: shows which day is being shown (today by default, or ?date=), and how many entries were loaded", async () => {
    // Today is the UTC date, as on the live and bulk pages (log ids are UTC timestamps).
    const NOW = new Date(Date.UTC(2025, 8, 3, 12, 0)); // 3 Sep 2025 12:00 UTC
    const dflt = await loadPage("data/logs.html", { api: readApi, now: NOW });
    assert.equal(dflt.document.getElementById("logDate").textContent, "2025-09-03");
    dflt.document.getElementById("fetchLogsButton").click();
    await until(() => dflt.calls.length > 0, "request");
    assert.ok(dflt.calls[0].url.includes("date=2025-09-03"), dflt.calls[0].url);
    dflt.close();

    const lateNight = await loadPage("data/logs.html", { api: readApi, now: new Date(Date.UTC(2025, 8, 3, 23, 59)) });
    assert.equal(lateNight.document.getElementById("logDate").textContent, "2025-09-03"); // still the UTC day
    lateNight.close();

    const page = await loadPage("data/logs.html", { query: "?date=2025-09-01", api: readApi });
    assert.equal(page.document.getElementById("logDate").textContent, "2025-09-01");
    page.document.getElementById("fetchLogsButton").click();
    await until(() => page.document.querySelectorAll("#logTable tbody tr").length === logs.length, "rows");
    assert.equal(page.document.getElementById("logsStatus").textContent, `${logs.length} entries for 2025-09-01.`);
    assert.ok(page.calls.some((c) => c.url.includes("date=2025-09-01")));
    page.close();

    const bad = await loadPage("data/logs.html", { query: "?date=not-a-date", api: readApi, now: NOW });
    assert.equal(bad.document.getElementById("logDate").textContent, "2025-09-03"); // invalid dates are ignored: today
    bad.close();
  });

  it("index: links to every admin page and the rest of the site", () => {
    const hrefs = [...parse("index.html").querySelectorAll("main a")].map((a) => a.getAttribute("href"));
    for (const wanted of ["./names.html", "./list-names.html", "./logs.html", "../index.html", "../age-manager/", "../demo/"]) {
      assert.ok(hrefs.includes(wanted), `index is missing a link to ${wanted}`);
    }
  });
});
