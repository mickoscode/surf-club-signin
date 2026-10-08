// CloudFront Function (viewer request), attached to the site's distribution in cloudfront.tf. It answers a few
// addresses with a redirect before the request reaches S3; every other request passes through unchanged.
// Keep it small: CloudFront Functions allow 10 KB of code and run on every request.
// tests/web/redirects.test.js runs this file, so the redirects below are checked in CI.
function redirect(location) {
  return {
    statusCode: 302,
    statusDescription: "Found",
    headers: { location: { value: location } },
  };
}

function handler(event) {
  var uri = event.request.uri;

  // The age manager guide used to be at /age-manager/ (it is now /am/info.html).
  if (uri === "/age-manager" || uri.indexOf("/age-manager/") === 0) {
    return redirect("/am/info.html");
  }

  // The demo only does something useful in test mode, so the bare address opens it in sign in test mode.
  if (uri === "/demo-am" || uri === "/demo-am/") {
    return redirect("/demo-am/index.html?test=in");
  }

  return event.request;
}
