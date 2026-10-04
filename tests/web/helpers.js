// Shared helpers for the frontend tests.
//
// The tests load the real generated pages (web/<site>/*.html) into jsdom, a pure-JavaScript
// browser DOM, with a fake `fetch` standing in for the API. Nothing touches the network or prod data.
// Run `./scripts/build-sites.sh` first so the generated pages exist (CI does this).
const { JSDOM, VirtualConsole, requestInterceptor } = require("jsdom");
const fs = require("node:fs");
const path = require("node:path");

const WEB_ROOT = path.resolve(__dirname, "..", "..", "web");

const SITE_ORIGIN = "https://sign-in-out.com/";

const CONTENT_TYPES = { ".js": "application/javascript", ".css": "text/css", ".html": "text/html", ".png": "image/png" };

// Answers every request the page makes itself (never passing one through to the network): the page's own
// <script src> / <link> files are served from web/, and anything else (e.g. unpkg's picnic CSS) is empty.
const localResources = requestInterceptor((request) => {
  if (!request.url.startsWith(SITE_ORIGIN)) {
    return new Response("", { headers: { "Content-Type": "text/css" } });
  }
  const file = path.join(WEB_ROOT, decodeURIComponent(new URL(request.url).pathname));
  if (!fs.existsSync(file)) return new Response("not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": CONTENT_TYPES[path.extname(file)] || "application/octet-stream" },
  });
});

// A display name that would run script if it were ever put into innerHTML.
const XSS = '<img src=x onerror="window.__xss=1">';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Poll until condition() is truthy (or fail after timeout) instead of sleeping a fixed time.
async function until(condition, what = "condition", timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = condition();
    if (value) return value;
    await sleep(10);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

// An API handler may return a plain object (HTTP 200 JSON) or reply(status, body).
const reply = (status, body = {}) => ({ __reply: true, status, body });

/**
 * Load a generated page.
 *   file:  path under web/, e.g. "demo/index.html"
 *   query: e.g. "?test=in"
 *   api:   (url, { method, body }) => object | reply(status, body)
 *   setup: optional (window) => void, run before the page's scripts (to shim browser APIs jsdom lacks)
 *   now:   optional Date; the page's clock is frozen at that instant (use local-time constructors,
 *          e.g. new Date(2025, 7, 10, 8, 30) = Sunday 10 Aug 2025, 08:30, so tests don't depend on timezone)
 * Returns { window, document, errors, alerts, calls, get, close }.
 *   errors: uncaught page errors   alerts: alert() messages   calls: every API request made
 */
async function loadPage(file, { query = "", api = () => ({}), now = null, setup = null } = {}) {
  const full = path.join(WEB_ROOT, file);
  if (!fs.existsSync(full)) {
    throw new Error(`${file} not found. Run ./scripts/build-sites.sh first to generate the pages.`);
  }

  const errors = [];
  const alerts = [];
  const calls = [];

  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (e) => errors.push(String(e.message || e)));

  const dir = path.dirname(file);
  const dom = await JSDOM.fromFile(full, {
    url: `https://sign-in-out.com/${dir}/${path.basename(file)}${query}`,
    runScripts: "dangerously",
    resources: { interceptors: [localResources] },
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      if (now) {
        const RealDate = window.Date;
        const frozen = now.getTime();
        window.Date = class extends RealDate {
          constructor(...args) {
            if (args.length === 0) super(frozen);
            else super(...args);
          }
          static now() {
            return frozen;
          }
        };
      }
      if (setup) setup(window);
      window.alert = (message) => alerts.push(String(message));
      window.scrollTo = () => {}; // not implemented in jsdom
      window.fetch = async (input, init = {}) => {
        const url = String(input);
        // header snippets are static files next to the page
        if (url.endsWith(".snippet")) {
          const snippet = path.join(WEB_ROOT, dir, path.basename(url));
          return { ok: true, status: 200, text: async () => fs.readFileSync(snippet, "utf8") };
        }
        const method = init.method || "GET";
        const body = init.body ? JSON.parse(init.body) : undefined;
        calls.push({ url, method, body });
        const result = api(url, { method, body });
        const { status, payload } = result && result.__reply
          ? { status: result.status, payload: result.body }
          : { status: 200, payload: result };
        return { ok: status < 400, status, json: async () => payload, text: async () => JSON.stringify(payload) };
      };
    },
  });

  const { window } = dom;
  // External scripts load asynchronously; wait until they have run before handing the page to the test.
  if (window.document.readyState !== "complete") {
    await new Promise((resolve) => window.addEventListener("load", resolve));
  }
  // get(name): read a top-level const/let from the page (those are not properties of window).
  const get = (name) => window.eval(name);
  return { window, document: window.document, errors, alerts, calls, get, close: () => window.close() };
}

// Type into an input and fire the "input" event, then wait out the page's 300ms debounce.
async function typeInto(page, input, value) {
  input.value = value;
  input.dispatchEvent(new page.window.Event("input", { bubbles: true }));
  await sleep(350);
}

// jsdom lacks the `form.fieldName` shortcut that real browsers (and the pages) rely on; add it to one form.
function addFormFieldShortcuts(form) {
  for (const field of form.elements) {
    if (field.name && !(field.name in form)) Object.defineProperty(form, field.name, { value: field, configurable: true });
  }
}

function submit(page, form) {
  form.dispatchEvent(new page.window.Event("submit", { bubbles: true, cancelable: true }));
}

module.exports = { XSS, sleep, until, reply, loadPage, typeInto, submit, addFormFieldShortcuts };
