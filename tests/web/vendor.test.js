const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const WEB = path.resolve(__dirname, "..", "..", "web");
const VENDOR = path.join(WEB, "main", "vendor");

// Every .html file under web/ (symlinked duplicates and generated pages included; they must all be clean).
function htmlFiles(dir = WEB, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, found);
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

// URLs the browser loads automatically: <script src> and <link href> (not <a href>).
function loadedAssets(html) {
  const urls = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) urls.push(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)) urls.push(m[1]);
  return urls;
}

describe("third-party assets are vendored, not loaded from a CDN", () => {
  it("no page loads a script or stylesheet from another host", () => {
    const external = [];
    for (const file of htmlFiles()) {
      for (const url of loadedAssets(fs.readFileSync(file, "utf8"))) {
        if (/^(https?:)?\/\//.test(url)) external.push(`${path.relative(WEB, file)} -> ${url}`);
      }
    }
    assert.deepEqual(external, []);
  });

  it("every local script/stylesheet a page loads exists next to the page", () => {
    const missing = [];
    for (const file of htmlFiles()) {
      for (const url of loadedAssets(fs.readFileSync(file, "utf8"))) {
        if (/^(https?:)?\/\//.test(url) || url.includes("{{")) continue; // external (checked above) / template placeholder
        if (!fs.existsSync(path.join(path.dirname(file), url.split(/[?#]/)[0]))) {
          missing.push(`${path.relative(WEB, file)} -> ${url}`);
        }
      }
    }
    assert.deepEqual(missing, []);
  });

  it("vendored files match their recorded SHA-256 (detects accidental edits)", () => {
    const lines = fs.readFileSync(path.join(VENDOR, "SHA256SUMS"), "utf8").trim().split("\n");
    assert.ok(lines.length >= 2);
    for (const line of lines) {
      const [expected, file] = line.split(/\s+/);
      const actual = crypto.createHash("sha256").update(fs.readFileSync(path.join(VENDOR, file))).digest("hex");
      assert.equal(actual, expected, `${file} has changed; see docs/vendored_assets.md if that was intended`);
    }
  });

  it("every vendored file has a licence file next to it", () => {
    for (const file of ["picnic-LICENSE.txt", "auth0-spa-js-LICENSE.txt"]) {
      assert.ok(fs.existsSync(path.join(VENDOR, file)), `missing ${file}`);
    }
  });
});
