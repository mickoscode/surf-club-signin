const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { XSS, until, reply, loadPage, submit } = require("./helpers");
const { readApi } = require("./fixtures");

describe("bulk page", () => {
  // alice already signed in (has an "in" log), evil also; bob has not. Only bob can be ticked for bulk sign-in.
  async function openBulk(bulkApi) {
    const api = (url, init) => (init.method === "POST" && url.endsWith("/bulk") ? bulkApi(init.body) : readApi(url));
    const page = await loadPage("demo-am/bulk.html", { query: "?test=in", api });
    await until(() => !page.document.getElementById("bulkForm").classList.contains("hidden"), "bulk form");
    return page;
  }
  const toggles = (page) => [...page.document.querySelectorAll(".name-toggle")];
  const message = (page) => page.document.getElementById("message").textContent;
  const post = (page) => page.calls.filter((c) => c.method === "POST");

  it("offers bulk sign-in with a button per group, and hides rows until a group is chosen", async () => {
    const page = await openBulk(() => reply(201, { written: 1, skipped: [] }));
    assert.equal(message(page), "Select a group for bulk sign-in");
    assert.equal(page.document.getElementById("bulkSubmitButton").textContent, "Bulk Sign In");
    const buttons = [...page.document.querySelectorAll("#filterButtons button")].map((b) => b.textContent);
    assert.deepEqual(buttons, ["All", "u14", "u15"]);
    assert.ok([...page.document.querySelectorAll("#namesTable tbody tr")].every((r) => r.classList.contains("hidden")));
    [...page.document.querySelectorAll("#filterButtons button")].find((b) => b.textContent === "u14").click();
    const visible = [...page.document.querySelectorAll("#namesTable tbody tr")].filter((r) => !r.classList.contains("hidden"));
    assert.equal(visible.length, 2); // alice + bob
    page.close();
  });

  it("only offers a checkbox to people who have not signed in yet, and shows names as text", async () => {
    const page = await openBulk(() => reply(201, { written: 1, skipped: [] }));
    assert.deepEqual(toggles(page).map((t) => t.dataset.nameId), ["bob"]);
    const rows = page.document.querySelectorAll("#namesTable tbody tr");
    assert.equal(rows[1].textContent.includes(XSS), true);
    assert.equal(page.document.querySelectorAll("#namesTable img").length, 0);
    page.close();
  });

  it("submits the ticked names and confirms", async () => {
    const page = await openBulk(() => reply(201, { written: 1, skipped: [] }));
    toggles(page)[0].checked = true;
    submit(page, page.document.getElementById("bulkForm"));
    await until(() => message(page).startsWith("Bulk submission completed"), "success message");
    const [call] = post(page);
    assert.equal(call.body.activity_id, "demo");
    assert.equal(call.body.direction, "in");
    assert.deepEqual(call.body.name_id_list, ["bob"]);
    assert.match(call.body.date_time, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(message(page), "Bulk submission completed");
    assert.equal(page.document.getElementById("bulkSubmitButton").disabled, true);
    page.close();
  });

  it("reports names that were already recorded", async () => {
    const page = await openBulk(() => reply(201, { written: 0, skipped: ["bob"] }));
    toggles(page)[0].checked = true;
    submit(page, page.document.getElementById("bulkForm"));
    await until(() => message(page).startsWith("Bulk submission completed"), "success message");
    assert.equal(message(page), "Bulk submission completed (1 already recorded)");
    page.close();
  });

  it("on failure, shows the error, keeps the button enabled, and retries with the same timestamp", async () => {
    let attempt = 0;
    const page = await openBulk(() => (++attempt === 1 ? reply(500, { message: "Internal server error" }) : reply(201, { written: 1, skipped: [] })));
    toggles(page)[0].checked = true;
    submit(page, page.document.getElementById("bulkForm"));
    await until(() => page.alerts.length > 0, "failure alert");
    assert.equal(message(page), "Bulk submission failed: Internal server error");
    assert.equal(page.document.getElementById("bulkSubmitButton").disabled, false);

    submit(page, page.document.getElementById("bulkForm"));
    await until(() => message(page).startsWith("Bulk submission completed"), "success after retry");
    const [first, second] = post(page);
    assert.equal(first.body.date_time, second.body.date_time);
    page.close();
  });

});
