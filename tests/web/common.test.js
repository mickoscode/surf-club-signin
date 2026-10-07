const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadPage } = require("./helpers");

// common.js is shared by every templated page; load one page and call its globals directly.
// Frozen clock: Wednesday 13 Aug 2025, 09:00 local time.
const WEDNESDAY = new Date(2025, 7, 13, 9, 0);
const open = (file = "main/index.html", options = {}) =>
  loadPage(file, { now: WEDNESDAY, ...options });


describe("common.js: API helpers", () => {
  it("apiUrl URL-encodes every query value and omits '?' when there are none", async () => {
    const page = await open();
    const { apiUrl } = page.window;
    const API_BASE = page.get("API_BASE");
    assert.equal(apiUrl("/log"), `${API_BASE}/log`);
    assert.equal(apiUrl("/log", { activity_id: "a b", date: "2025-08-12" }), `${API_BASE}/log?activity_id=a%20b&date=2025-08-12`);
    assert.equal(apiUrl("/x", { q: 'u14"><img>' }), `${API_BASE}/x?q=u14%22%3E%3Cimg%3E`);
    page.close();
  });

  it("postJson returns the body on success and throws a readable error otherwise", async () => {
    const replies = [
      { status: 201, body: { message: "ok" } },
      { status: 429, body: { message: "Too Many Requests" } },
      { status: 400, body: { message: "Missing name_id" } },
      { status: 502, body: {} }, // gateway error without a message
    ];
    const api = () => ({ __reply: true, ...replies.shift() });
    const page = await open("main/index.html", { api });
    const { postJson } = page.window;
    assert.deepEqual(await postJson("/log", { a: 1 }), { message: "ok" });
    await assert.rejects(() => postJson("/log", {}), /Too many requests right now/);
    await assert.rejects(() => postJson("/log", {}), /Missing name_id/);
    await assert.rejects(() => postJson("/log", {}), /Request failed \(HTTP 502\)/);
    page.close();
  });
});

describe("common.js: dates and times", () => {
  it("getNextSunday: from a weekday, the coming Sunday", async () => {
    const page = await open();
    assert.equal(page.window.getNextSunday(), "17 Aug 2025");
    page.close();
  });

  it("getNextSunday: on a Sunday, a week later", async () => {
    const page = await open("main/index.html", { now: new Date(2025, 7, 10, 7, 0) });
    assert.equal(page.window.getNextSunday(), "17 Aug 2025");
    page.close();
  });

  it("isSunday follows the real day, but is always true in test mode", async () => {
    const real = await open("main/index.html");
    assert.equal(real.window.isSunday(), false);
    real.close();
    const sunday = await open("main/index.html", { now: new Date(2025, 7, 10, 9, 0) });
    assert.equal(sunday.window.isSunday(), true);
    sunday.close();
    const demo = await open("demo/index.html");
    assert.equal(demo.window.isSunday(), true);
    demo.close();
  });

  it("getSessionWindow: 08:00 / 09:30 / 11:00 today on a real site", async () => {
    const page = await open();
    const w = page.window.getSessionWindow();
    const hm = (d) => [d.getHours(), d.getMinutes()];
    assert.deepEqual([hm(w.inStart), hm(w.outStart), hm(w.end)], [[8, 0], [9, 30], [11, 0]]);
    page.close();
  });

  it("getSessionWindow: demo ?test=in / ?test=out moves the window around now; ?test is ignored on real sites", async () => {
    const mins = (d, now) => Math.round((d - now) / 60000);
    const inPage = await open("demo/index.html", { query: "?test=in" });
    let w = inPage.window.getSessionWindow();
    assert.deepEqual([mins(w.inStart, w.now), mins(w.outStart, w.now), mins(w.end, w.now)], [-10, 10, 20]);
    inPage.close();

    const outPage = await open("demo/index.html", { query: "?test=out" });
    w = outPage.window.getSessionWindow();
    assert.deepEqual([mins(w.inStart, w.now), mins(w.outStart, w.now), mins(w.end, w.now)], [-20, -10, 20]);
    outPage.close();

    const real = await open("main/index.html", { query: "?test=in" });
    w = real.window.getSessionWindow();
    assert.equal(w.inStart.getHours(), 8);
    real.close();
  });

  it("convertTs2Time and convertTs2YMD format local time and pass '-' / empty through", async () => {
    const page = await open();
    const { convertTs2Time, convertTs2YMD } = page.window;
    const ts = new Date(2025, 7, 3, 7, 5).toISOString();
    assert.equal(convertTs2Time(ts), "07:05");
    assert.equal(convertTs2YMD(ts), "2025-08-03");
    assert.equal(convertTs2Time("-"), "-");
    assert.equal(convertTs2Time(""), "-");
    assert.equal(convertTs2YMD(undefined), "-");
    page.close();
  });
});

describe("common.js: names, logs and filters", () => {
  const names = [
    { name_id: "alice", display: "Alice", filter: "u14" },
    { name_id: "bob", display: "Bob", filter: "" },
  ];

  it("buildLogRows keeps one row per known person with their in/out, and skips unknown names", async () => {
    const page = await open();
    const rows = page.window.buildLogRows(names, [
      { name_id: "alice", direction: "in", date_time: "t1" },
      { name_id: "alice", direction: "out", date_time: "t2" },
      { name_id: "bob", direction: "in", date_time: "t3" },
      { name_id: "ghost", direction: "in", date_time: "t4" },
    ]);
    assert.deepEqual(Object.keys(rows), ["alice", "bob"]);
    assert.equal(rows.alice.in, "t1");
    assert.equal(rows.alice.out, "t2");
    assert.equal(rows.alice.f, "u14");
    assert.equal(rows.bob.out, "-");
    assert.equal(rows.bob.f, "default"); // no filter set
    page.close();
  });

});

describe("common.js: choosing the menu", () => {
  it("getMenuSource accepts user and leader, and otherwise uses the page's default", async () => {
    for (const [query, defaultSource, expected] of [
      ["", "user", "user"],
      ["", "leader", "leader"],
      ["?source=user", "leader", "user"],
      ["?source=leader", "user", "leader"],
      ["?source=admin", "user", "user"],
      ["?source=", "leader", "leader"],
      ["?source=USER", "leader", "leader"], // exact match only
    ]) {
      const page = await open("main/index.html", { query });
      assert.equal(page.window.getMenuSource(defaultSource), expected, `${query || "(none)"} with default ${defaultSource}`);
      page.close();
    }
  });
});
