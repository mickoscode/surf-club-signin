const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { until, reply, loadPage, submit } = require("./helpers");
const { readApi } = require("./fixtures");

const ROOT = path.resolve(__dirname, "..", "..");
const WEB = path.join(ROOT, "web");
const guideHtml = fs.readFileSync(path.join(WEB, "age-manager", "index.html"), "utf8");
const guide = new JSDOM(guideHtml).window.document;
const guideText = guide.body.textContent.replace(/\s+/g, " ");
const aboutText = new JSDOM(fs.readFileSync(path.join(WEB, "main", "about.template.html"), "utf8")).window.document.body.textContent.replace(/\s+/g, " ");
const bulkSource = fs.readFileSync(path.join(WEB, "main", "bulk.js"), "utf8");

// The session times the site really uses, written the way people read them ("9:30am").
const times = (() => {
  const m = fs.readFileSync(path.join(WEB, "main", "common.js"), "utf8")
    .match(/SESSION_TIMES = \{ inStart: "(\d\d):(\d\d)", outStart: "(\d\d):(\d\d)", end: "(\d\d):(\d\d)" \}/);
  assert.ok(m, "could not read SESSION_TIMES from common.js");
  const fmt = (h, min) => `${Number(h) % 12 || 12}:${min}${Number(h) < 12 ? "am" : "pm"}`;
  return { inStart: fmt(m[1], m[2]), outStart: fmt(m[3], m[4]), end: fmt(m[5], m[6]) };
})();

describe("age manager guide: wording", () => {

  it("quotes the buttons and messages exactly as the bulk page shows them", () => {
    for (const quoted of ["Bulk Sign In", "Bulk Sign Out", "Bulk submission completed", "Bulk submission failed", "already recorded"]) {
      assert.ok(guideText.includes(quoted), `the guide should mention "${quoted}"`);
      assert.ok(bulkSource.includes(quoted), `bulk.js no longer contains "${quoted}", so the guide is out of date`);
    }
    // the group buttons it tells people to tap
    assert.ok(guideText.includes("All") && /renderFilterButtons/.test(bulkSource));
  });

  it("quotes the session times the site really uses, and so does the about page", () => {
    for (const [name, text] of [["guide", guideText], ["about page", aboutText]]) {
      for (const t of [times.inStart, times.outStart, times.end]) assert.ok(text.includes(t), `${name} should say ${t}`);
    }
    assert.ok(!aboutText.includes("10:40") && !aboutText.includes("9:31"), "the about page still has the old sign out times");
    // sign out starts when sign in ends
    assert.ok(aboutText.includes(`Sign in is accessible from ${times.inStart} to ${times.outStart}`));
    assert.ok(aboutText.includes(`Sign out is accessible from ${times.outStart} to ${times.end}`));
  });
});

describe("age manager guide: links", () => {
  const hrefs = [...guide.querySelectorAll("a")].map((a) => a.getAttribute("href"));

  // Where a link on /age-manager/ lands on disk. The deployed site root is web/main; demo, data and age-manager are folders of their own.
  const fileFor = (href) => {
    const { pathname } = new URL(href, "https://sign-in-out.com/age-manager/");
    const first = pathname.split("/")[1];
    const base = ["demo", "data", "age-manager"].includes(first) ? path.join(WEB, pathname) : path.join(WEB, "main", pathname);
    return fs.existsSync(base) && fs.statSync(base).isDirectory() ? path.join(base, "index.html") : base;
  };

  it("every link goes to a page or in-page section that exists", () => {
    for (const href of hrefs) {
      if (href.startsWith("#")) { assert.ok(guide.getElementById(href.slice(1)), `no section ${href}`); continue; }
      assert.ok(fs.existsSync(fileFor(href)), `${href} does not exist (run ./scripts/build-sites.sh first)`);
    }
  });

});

// The guide's claims, checked against the real pages with a controlled clock.
describe("age manager guide: what it says matches what the pages do", () => {
  const SUNDAY = (h, m) => new Date(2025, 7, 10, h, m); // Sunday 10 Aug 2025, local time
  const WEEKDAY = new Date(2025, 7, 13, 9, 0); // Wednesday 9:00am
  const open = (file, options) => loadPage(file, { api: readApi, ...options });
  const message = (page) => page.document.getElementById("message").textContent;

  it("before 8:00am the bulk page says when sign in starts; it is not available on other days or after 11:00am", async () => {
    const early = await open("main/bulk.html", { now: SUNDAY(7, 0) });
    await until(() => message(early), "message");
    assert.equal(message(early), "Sign in starts at 8:00am");
    early.close();

    const late = await open("main/bulk.html", { now: SUNDAY(11, 30) });
    await until(() => message(late), "message");
    assert.match(message(late), /^The next session is/);
    late.close();

    const weekday = await open("main/bulk.html", { now: WEEKDAY });
    await until(() => message(weekday), "message");
    assert.match(message(weekday), /^The next session is/);
    weekday.close();
  });

  it("until 9:30am the button says Bulk Sign In; from 9:30am it says Bulk Sign Out", async () => {
    for (const [now, expected] of [[SUNDAY(8, 0), "Bulk Sign In"], [SUNDAY(9, 29), "Bulk Sign In"], [SUNDAY(9, 30), "Bulk Sign Out"], [SUNDAY(10, 59), "Bulk Sign Out"]]) {
      const page = await open("main/bulk.html", { now });
      await until(() => page.document.getElementById("bulkSubmitButton").textContent, "button text");
      assert.equal(page.document.getElementById("bulkSubmitButton").textContent, expected, now.toTimeString().slice(0, 5));
      page.close();
    }
  });

  it("the demo works on any day: it pretends it is sign in or sign out time, while the youth page says 'next session'", async () => {
    const ready = (page) => until(() => !page.document.getElementById("bulkForm").classList.contains("hidden"), "bulk form");

    const demoIn = await open("demo/bulk.html", { query: "?test=in", now: WEEKDAY });
    await ready(demoIn);
    assert.equal(message(demoIn), "Select a group for bulk sign-in");
    assert.equal(demoIn.document.getElementById("bulkSubmitButton").textContent, "Bulk Sign In");
    demoIn.close();

    const demoOut = await open("demo/bulk.html", { query: "?test=out", now: WEEKDAY });
    await ready(demoOut);
    assert.equal(message(demoOut), "Select a group for bulk sign-out");
    assert.equal(demoOut.document.getElementById("bulkSubmitButton").textContent, "Bulk Sign Out");
    demoOut.close();

    const single = await open("demo/index.html", { query: "?test=in", now: WEEKDAY });
    await until(() => !single.document.getElementById("signForm").classList.contains("hidden"), "demo sign-in form");
    single.close();

    const youth = await open("main/bulk.html", { now: WEEKDAY });
    await until(() => message(youth), "message");
    assert.match(message(youth), /^The next session is/);
    youth.close();
  });

  it("you can tick names in more than one group and send them all with one press; the button then turns grey", async () => {
    const twoGroups = {
      names: [
        { activity_id: "demo", name_id: "a1", display: "Ann One", filter: "u14" },
        { activity_id: "demo", name_id: "a2", display: "Ann Two", filter: "u15" },
        { activity_id: "demo", name_id: "a3", display: "Ann Three", filter: "u14" },
      ],
      logs: [],
    };
    const api = (url, init) => (init.method === "POST" ? reply(201, { written: 2, skipped: [] }) : url.includes("/name?") ? twoGroups : { logs: [] });
    const page = await loadPage("demo/bulk.html", { query: "?test=in", api });
    await until(() => !page.document.getElementById("bulkForm").classList.contains("hidden"), "bulk form");

    const groups = [...page.document.querySelectorAll("#filterButtons button")].map((b) => b.textContent);
    assert.deepEqual(groups, ["All", "u14", "u15"]);
    const tick = (nameId) => { page.document.querySelector(`.name-toggle[data-name-id="${nameId}"]`).checked = true; };
    [...page.document.querySelectorAll("#filterButtons button")].find((b) => b.textContent === "u14").click();
    tick("a1");
    [...page.document.querySelectorAll("#filterButtons button")].find((b) => b.textContent === "u15").click(); // a1 is now hidden but stays ticked
    tick("a2");

    submit(page, page.document.getElementById("bulkForm"));
    await until(() => message(page).startsWith("Bulk submission completed"), "success");
    const post = page.calls.find((c) => c.method === "POST");
    assert.deepEqual(post.body.name_id_list.sort(), ["a1", "a2"]);
    assert.equal(page.calls.filter((c) => c.method === "POST").length, 1);
    assert.equal(page.document.getElementById("bulkSubmitButton").disabled, true); // "turns grey"
    page.close();
  });

  it("people already signed in show a time instead of a box; when signing out only those who signed in have a box", async () => {
    const people = {
      names: [
        { activity_id: "demo", name_id: "here", display: "Signed In", filter: "u14" },
        { activity_id: "demo", name_id: "done", display: "Signed In And Out", filter: "u14" },
        { activity_id: "demo", name_id: "absent", display: "Not Here", filter: "u14" },
      ],
      logs: [
        { name_id: "here", direction: "in", date_time: "2025-08-12T08:05:00Z" },
        { name_id: "done", direction: "in", date_time: "2025-08-12T08:06:00Z" },
        { name_id: "done", direction: "out", date_time: "2025-08-12T09:40:00Z" },
      ],
    };
    const api = (url) => (url.includes("/name?") ? people : { logs: people.logs });
    const boxes = async (query) => {
      const page = await loadPage("demo/bulk.html", { query, api });
      await until(() => !page.document.getElementById("bulkForm").classList.contains("hidden"), "bulk form");
      const ids = [...page.document.querySelectorAll(".name-toggle")].map((t) => t.dataset.nameId);
      page.close();
      return ids;
    };
    assert.deepEqual(await boxes("?test=in"), ["absent"]); // here and done are already signed in (they show a time)
    assert.deepEqual(await boxes("?test=out"), ["here"]); // only signed-in youth who have not signed out
  });

});
