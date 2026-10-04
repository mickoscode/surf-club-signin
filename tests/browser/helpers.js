// Helpers for the real-browser tests: launch Chromium, open a page from the local server, fake the API at the
// network layer, and record anything that signals a Content-Security-Policy problem.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { policy } = require("./server");
const { readApi } = require("../web/fixtures");

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

// chromiumSandbox is off because Chromium's own sandbox cannot start inside Claude Code's sandbox (and may not
// on every CI image). That is fine here: these tests only open this repo's own pages from a local server.
const launch = () => chromium.launch({ chromiumSandbox: false });

/**
 * Open a page from the local server with the API faked.
 *   site:    the running server ({ url })
 *   urlPath: e.g. "/demo/index.html?test=in"
 *   api:     (url, { method, body }) => object | { status, body }  (default: the read-only fixtures; POSTs return 201)
 *   now:     optional Date to freeze the page's clock at (local-time constructors, as in the jsdom tests)
 * Returns { page, watch, calls, close }. watch collects every sign of trouble; use expectClean(watch).
 */
async function open(browser, site, urlPath, { api = defaultApi, now = null } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const watch = { violations: [], cspConsole: [], pageErrors: [], failedRequests: [], badResponses: [], dialogs: [] };
  const calls = [];

  // Every securitypolicyviolation event, in every frame, before any page script runs.
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__csp.push(`${e.effectiveDirective} blocked ${e.blockedURI || "inline"} (${e.sourceFile || "page"}:${e.lineNumber})`);
    });
  });

  page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) watch.cspConsole.push(m.text()); });
  page.on("pageerror", (e) => watch.pageErrors.push(String(e)));
  page.on("requestfailed", (r) => watch.failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(site.url) && !r.url().endsWith("/favicon.ico")) {
      watch.badResponses.push(`${r.status()} ${r.url()}`);
    }
  });
  page.on("dialog", (d) => { watch.dialogs.push(d.message()); d.dismiss(); });

  // The API and the Auth0 tenant never get a real request.
  const answer = async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = request.postData() ? JSON.parse(request.postData()) : undefined;
    calls.push({ url: request.url(), method: request.method(), body });
    const result = api(request.url(), { method: request.method(), body });
    const { status, payload } = result && result.__reply ? { status: result.status, payload: result.body } : { status: 200, payload: result };
    return route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(payload) });
  };
  await page.route(`${policy.apiUrl}/**`, answer);
  await page.route(`https://${policy.auth0Domain}/**`, (route) => {
    calls.push({ url: route.request().url(), method: route.request().method() });
    return route.fulfill({ status: 200, contentType: "text/html", body: "<title>Auth0 stub</title>" });
  });

  if (now) await page.clock.setFixedTime(now);
  await page.goto(`${site.url}${urlPath}`);
  return { page, watch, calls, close: () => context.close() };
}

const reply = (status, body = {}) => ({ __reply: true, status, body });
const defaultApi = (url, { method }) => (method === "POST" ? reply(201, { message: "ok", written: 1, skipped: [] }) : readApi(url));

// Fails with a readable list if anything went wrong: CSP violations (event and console), script errors,
// failed or 4xx/5xx same-origin requests. Also reads the page's own violation list.
async function expectClean({ page, watch }) {
  watch.violations = await page.evaluate(() => window.__csp || []);
  const problems = {};
  for (const key of ["violations", "cspConsole", "pageErrors", "failedRequests", "badResponses"]) {
    if (watch[key].length) problems[key] = watch[key];
  }
  assert.deepEqual(problems, {});
}

module.exports = { launch, open, expectClean, reply, defaultApi };
