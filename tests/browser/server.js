// A small static server that serves web/ the way CloudFront + S3 do, with the same security headers.
//
// The Content-Security-Policy is read from terraform/cloudfront.tf (not copied here), so these tests always
// run against the policy that production sends. The site is served from dist/ (assembled by scripts/build-sites.sh),
// which is laid out like the deployed bucket: the Youth view at the root, then /demo/, /data/ and /age-manager/.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const DIST = path.join(ROOT, "dist");

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png",
  ".json": "application/json", ".txt": "text/plain",
};

// Build the CSP string from the Terraform locals. Fails loudly if the file's shape changes.
function readPolicy() {
  const tf = fs.readFileSync(path.join(ROOT, "terraform", "cloudfront.tf"), "utf8");
  const auth0Domain = tf.match(/auth0_domain\s*=\s*"([^"]+)"/)?.[1];
  const list = tf.match(/content_security_policy\s*=\s*join\("; ",\s*\[([\s\S]*?)\]\)/)?.[1];
  if (!auth0Domain || !list) throw new Error("Could not find the CSP locals in terraform/cloudfront.tf");

  const apiUrl = JSON.parse(fs.readFileSync(path.join(ROOT, "web", "youth", "config.json"), "utf8")).INJECT_API_URL;
  const directives = [...list.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*,/gm)].map((m) =>
    m[1]
      .replaceAll("${aws_apigatewayv2_api.api.api_endpoint}", apiUrl)
      .replaceAll("${local.auth0_domain}", auth0Domain));
  if (directives.length < 5 || directives.some((d) => d.includes("${"))) {
    throw new Error(`Could not resolve the CSP from cloudfront.tf: ${JSON.stringify(directives)}`);
  }
  return { directives, apiUrl, auth0Domain };
}

const policy = readPolicy();

// The page CloudFront serves, with status 404, for any address that does not exist. Read from the same file.
const errorPagePath = fs.readFileSync(path.join(ROOT, "terraform", "cloudfront.tf"), "utf8")
  .match(/custom_error_response\s*\{[^}]*?error_code\s*=\s*404[^}]*?response_page_path\s*=\s*"([^"]+)"/)?.[1];
if (!errorPagePath) throw new Error("Could not find the 404 custom_error_response in terraform/cloudfront.tf");

// upgrade-insecure-requests only matters for https transport; this server is plain http on 127.0.0.1, where
// it would rewrite every request to https and break the page, so it is the one directive left out here.
const cspHeader = policy.directives.filter((d) => d !== "upgrade-insecure-requests").join("; ");

function resolveFile(urlPath) {
  const parts = decodeURIComponent(urlPath.split("?")[0]).split("/").filter(Boolean);
  if (parts.includes("..")) return null;
  let file = path.join(DIST, ...parts);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  return fs.existsSync(file) ? file : null;
}

// Returns { url, close } for a server on a free port.
async function startServer() {
  const server = http.createServer((req, res) => {
    let status = 200;
    let file = resolveFile(req.url);
    if (!file) {
      // like CloudFront's custom error response: the error page's content, with the 404 status
      status = 404;
      file = resolveFile(errorPagePath);
      if (!file) { res.writeHead(404, { "Content-Type": "text/plain" }).end("not found"); return; }
    }
    res.writeHead(status, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      "Content-Security-Policy": cspHeader,
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

module.exports = { startServer, policy, cspHeader, errorPagePath };
