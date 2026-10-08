const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// terraform/redirects.js is the CloudFront Function that answers a few addresses with a redirect. Run it as is.
const code = fs.readFileSync(path.resolve(__dirname, "..", "..", "terraform", "redirects.js"), "utf8");
const handler = vm.runInNewContext(`${code}; handler`);
const run = (uri) => handler({ request: { uri } });

it("sends the old age manager guide address and the bare demo-am address to the right pages, and leaves everything else alone", () => {
  for (const uri of ["/age-manager", "/age-manager/", "/age-manager/index.html"]) {
    const res = run(uri);
    assert.equal(res.statusCode, 302, uri);
    assert.equal(res.headers.location.value, "/am/info.html", uri);
  }
  for (const uri of ["/demo-am", "/demo-am/"]) {
    assert.equal(run(uri).headers.location.value, "/demo-am/index.html?test=in", uri);
  }
  // real pages must pass through (a redirect here would loop)
  for (const uri of ["/", "/index.html", "/am/", "/am/info.html", "/demo-am/index.html", "/demo-am/info.html", "/demo/", "/age-manager-notes"]) {
    assert.deepEqual(run(uri), { uri }, uri);
  }
});
