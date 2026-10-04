# Vendored third-party assets

The site serves its CSS and JavaScript libraries from its own origin (`web/main/vendor/`) instead of loading
them from a CDN. That removes a supply-chain risk (a changed or compromised CDN file would run on the site),
removes a runtime dependency on the CDN, and allows a strict Content-Security-Policy.

| File | Package | Version | Used by |
|---|---|---|---|
| `picnic.min.css` | [`picnic`](https://www.npmjs.com/package/picnic) (MIT) | 7.1.0 | every page |
| `auth0-spa-js.production.js` | [`@auth0/auth0-spa-js`](https://www.npmjs.com/package/@auth0/auth0-spa-js) (MIT) | 1.22.6 | `web/data/index.html` (login stub) |

The files are copied unchanged from the npm tarballs. `web/main/vendor/SHA256SUMS` records their checksums, and a
test (`tests/web/vendor.test.js`) fails if a vendored file is edited by accident, if a page loads a script or
stylesheet from another host, or if a page references a local file that is missing.

Every site folder (and `web/data`, `web/age-manager`) has a `vendor` symlink to `../main/vendor`, so pages load
`vendor/picnic.min.css` relative to themselves. A new site needs that symlink; `scripts/build-sites.sh` fails without it.

## Updating

Dependabot does not track copied files, so check for new versions now and then (`npm view picnic version`).

```bash
cd "$(mktemp -d)"
npm pack picnic@<version> @auth0/auth0-spa-js@<version>        # npm verifies the registry integrity hash
tar xzf picnic-<version>.tgz && tar xzf auth0-auth0-spa-js-<version>.tgz   # each extracts to ./package/
# copy package/picnic.min.css, package/dist/auth0-spa-js.production.js and the LICENSE files into web/main/vendor/
cd <repo>/web/main/vendor && sha256sum picnic.min.css auth0-spa-js.production.js > SHA256SUMS
```

Then update the versions in the table above, run `./scripts/build-sites.sh && npm test`, and check a page in `web/demo`
in a browser (picnic styles every page). The Auth0 SDK is only used by the stub login on `web/data/index.html`; if that
stub is ever removed, delete the SDK from `vendor/` as well.
