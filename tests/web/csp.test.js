const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const WEB = path.join(ROOT, "web");

// Everything the browser could parse as markup: pages, templates and the header menu snippets.
function markupFiles(dir = WEB, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) markupFiles(full, found);
    else if (/\.(html|snippet)$/.test(entry.name)) found.push(full);
  }
  return found;
}

// The site's Content-Security-Policy allows only its own scripts and styles (no 'unsafe-inline'),
// so any inline script, inline event handler or style attribute would be blocked in the browser.
describe("pages are compatible with a strict Content-Security-Policy", () => {
  const problems = (pattern, label) =>
    markupFiles().flatMap((file) =>
      [...fs.readFileSync(file, "utf8").matchAll(pattern)].map((m) => `${path.relative(WEB, file)}: ${label}: ${m[0].slice(0, 60)}`));

  it("no inline <script> blocks (every script has a src)", () => {
    assert.deepEqual(problems(/<script(?![^>]*\bsrc=)[^>]*>/gi, "inline script"), []);
  });

  it("no inline event handler attributes (onclick=, onsubmit=, ...)", () => {
    assert.deepEqual(problems(/<[a-z][^>]*\son[a-z]+\s*=/gi, "inline handler"), []);
  });

  it("no <style> blocks or style= attributes", () => {
    assert.deepEqual(problems(/<style[\s>]/gi, "style block"), []);
    assert.deepEqual(problems(/<[a-z][^>]*\sstyle\s*=/gi, "style attribute"), []);
  });

  it("no javascript: URLs", () => {
    assert.deepEqual(problems(/(href|src|action)\s*=\s*["']\s*javascript:/gi, "javascript: url"), []);
  });
});

describe("the Content-Security-Policy in Terraform matches what the pages use", () => {
  const cloudfront = fs.readFileSync(path.join(ROOT, "terraform", "cloudfront.tf"), "utf8");

  it("allows the Auth0 tenant that web/data/index.js talks to", () => {
    const domain = fs.readFileSync(path.join(WEB, "data", "index.js"), "utf8").match(/domain:\s*"([^"]+)"/)[1];
    assert.ok(cloudfront.includes(domain), `cloudfront.tf CSP must allow ${domain}`);
  });

  it("every site's config.json points at the API Gateway the CSP allows (one API)", () => {
    const apis = new Set(
      fs.readdirSync(WEB).map((d) => path.join(WEB, d, "config.json")).filter(fs.existsSync)
        .map((f) => JSON.parse(fs.readFileSync(f, "utf8")).INJECT_API_URL));
    assert.equal(apis.size, 1, `sites use different APIs: ${[...apis]}`);
  });
});
