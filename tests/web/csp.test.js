const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const WEB = path.resolve(__dirname, "..", "..", "web");

// Everything the browser could parse as markup: pages, templates and the header menu snippets.
function markupFiles(dir = WEB, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) markupFiles(full, found);
    else if (/\.(html|snippet)$/.test(entry.name)) found.push(full);
  }
  return found;
}

// The site's Content-Security-Policy allows only its own scripts and styles (no 'unsafe-inline'), so inline code
// would be blocked in the browser. The real-browser tests enforce this at runtime; this is the quick early warning,
// with the file and the offending snippet in the message.
it("no page, template or menu contains inline code (script blocks, on... handlers, <style>, style=, javascript: URLs)", () => {
  const checks = [
    [/<script(?![^>]*\bsrc=)[^>]*>/gi, "inline script"],
    [/<[a-z][^>]*\son[a-z]+\s*=/gi, "inline handler"],
    [/<style[\s>]/gi, "style block"],
    [/<[a-z][^>]*\sstyle\s*=/gi, "style attribute"],
    [/(href|src|action)\s*=\s*["']\s*javascript:/gi, "javascript: url"],
  ];
  const problems = markupFiles().flatMap((file) => {
    const html = fs.readFileSync(file, "utf8");
    return checks.flatMap(([pattern, label]) => [...html.matchAll(pattern)].map((m) => `${path.relative(WEB, file)}: ${label}: ${m[0].slice(0, 60)}`));
  });
  assert.deepEqual(problems, []);
});
