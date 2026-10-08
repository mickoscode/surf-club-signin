const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { XSS, sleep, until, reply, loadPage, typeInto, submit } = require("./helpers");
const { readApi } = require("./fixtures");

// ?test=in / ?test=out on the demo site forces the sign-in / sign-out window to be open.
async function openSignIn(direction = "in", api = readApi) {
  const page = await loadPage("demo/index.html", { query: `?test=${direction}`, api });
  await until(() => !page.document.getElementById("signForm").classList.contains("hidden"), "sign form");
  await until(() => page.calls.some((c) => c.url.includes("/name?")), "names request");
  // The page attaches its typing handlers only after the names response has been processed.
  await sleep(50);
  return page;
}

describe("sign-in page: name suggestions", () => {
  it("suggests matching names and highlights the typed text, keeping the name's own casing", async () => {
    const page = await openSignIn();
    await typeInto(page, page.document.getElementById("nameInput"), "ali");
    const items = page.document.querySelectorAll(".dropdown-item");
    assert.equal(items.length, 1);
    assert.equal(items[0].textContent, "Alice Smith");
    assert.equal(items[0].querySelector(".highlight").textContent, "Ali");
    page.close();
  });

  // Typing regex characters used to crash the suggestions (the typed text was turned into a RegExp).
  it("special characters typed into the name box do not break it, and match literally", async () => {
    const page = await openSignIn();
    const input = page.document.getElementById("nameInput");
    for (const typed of ["(", "[", "\\", ".*"]) await typeInto(page, input, typed);
    assert.deepEqual(page.errors, []);
    await typeInto(page, input, "b) [");
    const items = page.document.querySelectorAll(".dropdown-item");
    assert.equal(items.length, 1);
    assert.equal(items[0].textContent, "Bob (b) [x]");
    page.close();
  });

  it("shows a name containing HTML as plain text and never creates elements from it", async () => {
    const page = await openSignIn();
    await typeInto(page, page.document.getElementById("nameInput"), "img");
    const items = page.document.querySelectorAll(".dropdown-item");
    assert.equal(items.length, 1);
    assert.equal(items[0].textContent, XSS);
    assert.equal(page.document.querySelectorAll(".dropdown img").length, 0);
    page.close();
  });
});

describe("sign-in page: submitting", () => {
  async function pickAlice(page) {
    await typeInto(page, page.document.getElementById("nameInput"), "ali");
    page.document.querySelector(".dropdown-item").click();
  }

  it("posts the log, confirms it, disables the button and remembers the name", async () => {
    const api = (url, init) => (init.method === "POST" ? reply(201, { message: "ok" }) : readApi(url));
    const page = await openSignIn("in", api);
    await pickAlice(page);
    submit(page, page.document.getElementById("signForm"));
    await until(() => page.document.getElementById("submitButton").disabled, "button disabled after success");

    const post = page.calls.find((c) => c.method === "POST");
    assert.ok(post.url.endsWith("/log"));
    assert.equal(post.body.activity_id, "demo");
    assert.equal(post.body.name_id, "alice");
    assert.equal(post.body.direction, "in");
    assert.match(post.body.date_time, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(page.document.getElementById("message").textContent, "Alice Smith has signed in");
    assert.equal(page.window.localStorage.getItem("name_id"), "alice");
    assert.deepEqual(page.alerts, []);
    page.close();
  });

  it("tells the user when the API is throttling (HTTP 429) and leaves the button usable", async () => {
    const api = (url, init) => (init.method === "POST" ? reply(429, { message: "Too Many Requests" }) : readApi(url));
    const page = await openSignIn("in", api);
    await pickAlice(page);
    submit(page, page.document.getElementById("signForm"));
    await until(() => page.alerts.length > 0, "an alert");
    assert.match(page.alerts[0], /Too many requests right now/);
    assert.equal(page.document.getElementById("submitButton").disabled, false);
    assert.notEqual(page.document.getElementById("message").textContent, "Alice Smith has signed in");
    page.close();
  });

  it("shows the API's error message instead of reporting success", async () => {
    const api = (url, init) => (init.method === "POST" ? reply(500, { message: "Internal server error" }) : readApi(url));
    const page = await openSignIn("in", api);
    await pickAlice(page);
    submit(page, page.document.getElementById("signForm"));
    await until(() => page.alerts.length > 0, "an alert");
    assert.equal(page.alerts[0], "Error: Internal server error");
    assert.equal(page.window.localStorage.getItem("name_id"), null);
    page.close();
  });

});

describe("sign-in page: session window (real site rules, frozen clock)", () => {
  // The youth site has test mode off, so it enforces Sundays only, in 08:00 / 09:30 / 11:00 windows.
  const SUNDAY = (h, m) => new Date(2025, 7, 10, h, m); // Sunday 10 Aug 2025
  const open = async (now) => loadPage("index.html", { api: readApi, now });

  it("on a weekday, says when the next session is and shows no form", async () => {
    const page = await open(new Date(2025, 7, 13, 9, 0)); // Wednesday
    await until(() => page.document.getElementById("message").textContent, "message");
    assert.equal(page.document.getElementById("message").textContent, "The next session is 17 Aug 2025");
    assert.ok(page.document.getElementById("signForm").classList.contains("hidden"));
    page.close();
  });

  it("before 08:00 on Sunday, says sign in has not started", async () => {
    const page = await open(SUNDAY(7, 0));
    await until(() => page.document.getElementById("message").textContent, "message");
    assert.equal(page.document.getElementById("message").textContent, "Sign in starts at 8:00am");
    assert.ok(page.document.getElementById("signForm").classList.contains("hidden"));
    page.close();
  });

  it("08:00-09:30 on Sunday is sign in", async () => {
    const page = await open(SUNDAY(8, 30));
    await until(() => page.document.getElementById("submitButton").textContent === "Sign In", "Sign In button");
    assert.ok(!page.document.getElementById("signForm").classList.contains("hidden"));
    page.close();
  });

  it("09:30-11:00 on Sunday is sign out", async () => {
    const page = await open(SUNDAY(10, 0));
    await until(() => page.document.getElementById("submitButton").textContent === "Sign Out", "Sign Out button");
    page.close();
  });

  it("after 11:00 on Sunday, says the next session is next week", async () => {
    const page = await open(SUNDAY(11, 30));
    await until(() => page.document.getElementById("message").textContent, "message");
    assert.equal(page.document.getElementById("message").textContent, "The next session is 17 Aug 2025");
    assert.ok(page.document.getElementById("signForm").classList.contains("hidden"));
    page.close();
  });
});
