# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Paperless sign-in/out web app for surf club activities, live at sign-in-out.com. The only active team is Youth (`sorrento_youth_sunday`, served from the root); a `demo` site (activity `demo`) is used for testing and for showing age managers how it works. Static HTML/JS frontend hosted on S3 + CloudFront, serverless backend of API Gateway (HTTP API) → Python Lambdas → DynamoDB. Much of the config is hard-coded to one AWS account/environment (ap-southeast-2). The site itself has no dependencies; `scripts/build-sites.sh` just assembles the pages into `dist/` (templates filled from each view's config). The only `package.json` is dev tooling for the frontend tests (jsdom), and the only linting is `tflint`/`terraform fmt` on `terraform/`, run in CI.

## Commands

Assemble and validate the whole site (what CI runs; needs Node): `./scripts/build-sites.sh`. It rebuilds `dist/` (git-ignored) from scratch, laid out exactly like the S3 bucket, and fails on missing `config.json` keys, unreplaced `{{INJECT_*}}` placeholders, or a page that loads a script/stylesheet missing from `dist/`. Tests, the browser test server, Live Server and the deploy all use `dist/`; never edit it.

Frontend tests (Node 24; loads the generated pages into jsdom against a fake API, no network): run `./scripts/build-sites.sh` first, then `npm ci --ignore-scripts && npm test`. Tests live in `tests/web/` (`helpers.js` has `loadPage`, which fakes `fetch` and can freeze the clock; `fixtures.js` has sample data). CI runs them in `Validate sites`.

Test policy: one maintainer, so keep only tests likely to catch a real break (page behaviour, API error handling, CSP, menu/link wiring); no tests for cosmetic or low-risk changes, and no multiplying one check across many widths or pages (one phone width is enough).

Browser tests (`npm run test:browser`, needs `npx playwright install chromium` once): `tests/browser/` loads each kind of page and the main user flows in real Chromium via Playwright, served by a small local server (`server.js`) that sends the **exact CSP parsed from `terraform/cloudfront.tf`**, with the API and Auth0 faked at the network layer. Every test fails on any CSP violation, script error, failed request or 4xx asset; `policy.test.js` has positive controls (an injected inline script, handler, style and a request to another host must be blocked). Chromium runs with its own sandbox off (it cannot start inside Claude Code's sandbox) and reads the policy from the .tf file, so changing the CSP there is tested automatically; `upgrade-insecure-requests` is the one directive the plain-http test server drops. CI runs these in `Validate sites` too.

Local dev: serve the repo with the VS Code Live Server extension and browse to e.g. `http://localhost:5500/dist/index.html` after running the build. Pages call the real prod API URL from `config.json`; use `dist/demo` (activity `demo`, test mode on) to avoid touching prod data.

Infrastructure (Terraform Cloud backend, org `mickoscode`, workspace `surf-club-signin`):

```bash
cd terraform && terraform plan -var-file=tfvars/prod.tfvars
cd terraform && terraform fmt -recursive && tflint --init && tflint   # same checks CI runs (config: terraform/.tflint.hcl)
```

Data admin scripts in `scripts/` shell out to the AWS CLI, e.g. `python3 scripts/import_names_csv.py <activity_id>` (expects `./names.csv`; `VALID_ACTIVITY_IDS` in the script must include the activity). `scripts/get-logs.bash <name_id> [--full]` queries the log table.

## Architecture

### Frontend: shared code plus four views (youth, age manager, and a demo of each)

**Layout of `web/`: each folder holds either what is common or what is unique to one view, never both; no symlinks.**

| Folder | Served at | Audience and contents |
|---|---|---|
| `web/shared/` | copied into every view | `templates/*.template.html`, `scripts/` (`common.js`, one script per page, `static-page.js`), `styles/` (`sign-in-out.css`, `guide.css`), `icons/` (one tab icon per view, chosen by `INJECT_FAVICON`), `vendor/` |
| `web/youth/` | `/` (site root) | youth signing themselves in: `config.json`, `header.snippet`, `404.html`. Pages: index (sign in/out), live, history, about |
| `web/am/` | `/am/` | age managers: `config.json`, `header.snippet`, `index.html` (the guide). Pages: bulk (sign in/out), live, history, about |
| `web/demo/` | `/demo/` | practice copy of youth (activity `demo`, test mode on): `config.json`, `header.snippet`, `guide.html` (demo instructions). Pages: index, live, about |
| `web/demo-am/` | `/demo-am/` | practice copy of age manager: `config.json`, `header.snippet`, `index.html` (demo instructions). Pages: bulk, live, history, about |
| `web/data/` | `/data/` | the name admin pages (standalone, not a view, not templated) |

Each view serves one audience, with one menu and one tab icon, and nothing about the audience is decided at runtime. A view is any `web/<folder>/` with a `config.json`, which holds `INJECT_PAGE_TITLE`, `INJECT_API_URL`, `INJECT_FAVICON` (a file in `web/shared/icons/`), `INJECT_ACTIVITY_ID`, `INJECT_ENABLE_TEST_MODE` and `PAGES` (which templates the view has).

`scripts/build-sites.sh` builds `dist/`: for each folder with a `config.json` (a templated view; `youth` goes to the root, others to `/<folder>/`) it copies in `common.js`, `static-page.js`, the stylesheets, `vendor/`, the view's icon and the script of each page in `PAGES`, then the view's own files on top (a view's own pages such as a guide must not share a name with a `PAGES` entry), then fills each listed template via `scripts/inject-config.js`. `data` is copied as it is and loads the shared files from the site root (`../sign-in-out.css`, `../vendor/`). Templates, configs and `inject-config.js` are build inputs and are not deployed.

- **Edit the sources under `web/`** (`web/shared/templates/*.template.html` and `web/shared/scripts/*.js`), never the generated pages in `dist/`.
- Page logic is in plain `<script src>` files, not inline: `common.js` (shared helpers: per-site settings, header loading, session window, date/time formatting, `getJson`/`postJson` with error handling, name/log row building, filter buttons) plus one script per page (`index.js`, `bulk.js`, `live.js`, `history.js`). Per-site settings reach the scripts as `data-api-url`, `data-activity-id` and `data-test-mode` attributes on `<body>`, written into each template by `scripts/inject-config.js`. A page's script always loads after `common.js`, so top-level names in the two share one global scope (don't redeclare `API_BASE`, `ACTIVITY_ID`, etc.). The `web/data/` pages follow the same rule with one script file each (`index.js`, `names.js`, `list-names.js`, `logs.js`); they hardcode the API URL and are not templated.
- **Data admin pages (`web/data/`) look and navigate like the rest of the site**: each loads picnic, `../sign-in-out.css` (the shared theme, from the site root: page background, white card, the `.menu-header` bar) and `admin.css` (what the admin pages add: wider card, forms, tables, name list, tabs, status messages). They share one static menu (`home`, `add / edit`, `names`, `logs`) that is copied into each page, with `aria-current="page"` on its own link; `tests/web/data-pages.test.js` fails if the copies drift apart. Form controls built in JS (`names.js`) are wrapped in `.field` with a `<label for>`; keep the element ids and `name` attributes (the tests and the page code use them). Tables sit in `.table-scroll` so a wide one scrolls inside its box on a phone instead of stretching the page, and `#message` / the status lines are `role="status"`.
- `sign-in-out.css` overrides picnic's `html, body { height: 100% }` (`html`/`body` are `height: auto` and the gradient is `no-repeat`): otherwise on any page taller than the screen the background gradient stops after the first screen and restarts below it.
- Third-party assets (`picnic.min.css`, the Auth0 SDK) are vendored in `web/shared/vendor/`, not loaded from a CDN; the build copies them into the youth and demo views, and `web/data` loads them from the site root (`../vendor/`). See `docs/vendored_assets.md` for versions and how to update. A test fails if any page loads a script or stylesheet from another host.
- **No inline code anywhere in `web/`**: no inline `<script>`, `onclick=`-style handlers, `<style>` blocks or `style=` attributes (wire handlers with `addEventListener`, put styles in `.css` files). The site's Content-Security-Policy (`terraform/cloudfront.tf`, sent via CloudFront) allows only same-origin scripts and styles, so inline code would be blocked in the browser; `tests/web/csp.test.js` enforces this. The policy is enforced (`var.csp_enforce = true`; set it to `false` to fall back to `Content-Security-Policy-Report-Only`, which only logs violations to the browser console). If a page needs another host (a new API, CDN or Auth0 tenant), add it to `connect-src`/etc. in `cloudfront.tf`.
- **Wording of messages**: one rule for everything a person reads (the pages, the admin pages, and the messages the Lambdas return): sentence case, no trailing full stop, no exclamation mark ("Bulk submission completed", "Duplicate log entry", "Please type and select an allowed name"); times are written "8:00am" (`formatClock`); button labels stay in Title Case ("Bulk Sign In"). The age manager guide quotes some messages and buttons exactly, so change them together. **Tables** on live, history and bulk use `.records-table` inside `.table-scroll` (in `sign-in-out.css`): picnic's own cell padding (2.4em on the right) made them wider than the card on phones, so it is overridden there.
- `scripts/inject-config.js` replaces `{{KEY}}` placeholders with values from the view's `config.json` (`INJECT_PAGE_TITLE`, `INJECT_API_URL`, `INJECT_FAVICON`, `INJECT_ACTIVITY_ID`, `INJECT_ENABLE_TEST_MODE`). Every key a template uses must exist in config.json.
- The Youth view (`web/youth/`) and the Demo view (`web/demo/`) hold only their own `config.json`, menus and icon(s) (Youth also `404.html`); everything else comes from `web/shared/` at build time. Pages fetch their menu snippet at runtime to get a per-site nav menu.
- **Menus**: every view has exactly one menu, `header.snippet`, next to its pages; `loadMenu()` (`common.js`) fetches it and every page, guide and the 404 page calls it (via `static-page.js` for content-only pages). There is no `?source=` and no menu switching: the audience is the view. The first item of each menu is the view's label, which is a link to the view's guide: **YOUTH** (plain text), **AM** (`/am/`), **DEMO-Y** (`/demo/guide.html`) and **DEMO-A** (`/demo-am/`). The tab icon is the view's `INJECT_FAVICON`: green striped `faviconV2.png` (youth), purple A `favicon-am.png` (age manager), orange D `favicon-demo.png` (both demos); the guide pages name their icon in their own `<link rel=icon>`. `loadHeader` ignores a non-OK response: CloudFront answers a missing file with the whole 404 page, which must never be pasted into the menu bar. The menu is fetched after the page renders, so `#header-container` reserves its height (48px) in the CSS to stop the page jumping; the menu wraps instead of overflowing on very narrow screens (at 320px the longest, DEMO-A, only just fits). `tests/web/menu.test.js` and `tests/browser/menu.test.js` cover all of this.
- **`about.html` is generated** from `about.template.html` (per-view favicon and settings; the menu comes from the view) and uses `static-page.js` (menu only). **`404.html` is a static page**, not a template: it is CloudFront's custom error page (`custom_error_response` in `cloudfront.tf`, status 404), which is served for any missing address at any depth, so it uses `<base href="/">`; without it its stylesheets, favicon, scripts and menu all resolve against the missing address and fail. Keep every URL on it relative (the base makes them root-relative), and don't use Live Server to look at it (use the deployed site or the browser tests, whose server reproduces the CloudFront behaviour).
- `INJECT_ENABLE_TEST_MODE: "true"` (demo) enables the test/demo behaviour (e.g. bypassing the activity time window).
- **Guides**: `web/am/index.html` is a plain-language guide for non-technical age managers (the only people who use bulk sign in): the Sunday links, the bulk sign in steps, and a link to the demo. `web/demo-am/index.html` and `web/demo/guide.html` are the demo instructions for the two audiences (practice links with `?test=in` / `?test=out`, any day, separate demo data). They use `guide.css` and the menu like any other page. The session times the AM guide quotes (and the about page's) must match `SESSION_TIMES` in `common.js`; `tests/web/guides.test.js` checks this, and checks the steps against what the bulk page really does. Keep them in plain language. `web/data/` is standalone.

Adding another team (none planned; the colour age-group sites were removed): populate the `names` table for the new `activity_id`, copy the youth and am folders with `cp -R web/youth web/<x>` and `cp -R web/am web/<x>-am` (each holds only a config, a menu and its own pages; `build-sites.sh` picks up any folder with a `config.json`; the root view is `root_view` in the script), edit their `config.json` (activity id, `INJECT_ENABLE_TEST_MODE` false) and menus, and add the activity id to `VALID_ACTIVITY_IDS` in `scripts/import_names_csv.py` and `scripts/delete_all_log_history.py`, to `VALID_ACTIVITY_ID` in `web/data/names.js` and `web/data/list-names.js`, to the links in `web/data/list-names.html`, and the links in `web/am/index.html`. CI discovers sites automatically (any `web/<folder>/` with a `config.json`), so no workflow edits are needed.

### Deployment

All workflows live in `.github/workflows/`; third-party actions are pinned to commit SHAs (Dependabot updates them weekly).

- `sync-sio.yml` (frontend) runs on push to `main`: runs `scripts/build-sites.sh`, `aws s3 sync`s `dist/` (the whole bucket layout) to the bucket with `--delete`, then invalidates CloudFront (one `/*` invalidation). Merging to main deploys to prod.
- `web-pr.yml` runs on PRs that touch the frontend and runs the same `scripts/build-sites.sh`; it also runs the frontend tests, and `Validate sites` can be a required check (skipped, not absent, when `web/` is unchanged).
- `delete-merged-branch.yml` deletes a pull request's branch after it is merged (same-repo branches only, never the default branch). It needs only `contents: write` on its own job; the branch name is passed via `env`, not interpolated into the script.
- `data-to-s3.yml` is a manual "push only `web/data`" button (no inputs; bucket, region and distribution are fixed). `sync-sio.yml` also syncs `web/data` on every merge.
- `terraform-pr.yml` runs on PRs that touch `terraform/`: `terraform fmt -check`, `validate`, `tflint`, a blocking Trivy scan (accepted findings are listed with reasons in `terraform/.trivyignore.yaml`), and a speculative `terraform plan` posted as a PR comment with a link to the full plan in HCP Terraform. Jobs are skipped (not absent) when `terraform/` is unchanged, so `Terraform validate`, `Terraform plan` and `Terraform security scan` are required checks on `main`.
- `terraform-apply.yml` runs on push to `main` when `terraform/` changes (or by manual dispatch): checks, a plan, then an `apply` job gated by the `terraform-production` GitHub Environment, which needs a manual approval. It is skipped when the plan has no changes. Terraform runs remotely in HCP Terraform; GitHub only needs the `TF_API_TOKEN` secret.
- `terraform-drift.yml` runs weekly (and manually): a speculative plan of `main`; it fails, so GitHub emails you, if the live AWS resources differ from the code. It never applies.

AWS auth for the frontend workflows is GitHub OIDC: they assume `github-deploy-role` (defined in `terraform/iam.tf`, trusted for the `main` branch only), so there are no AWS keys in GitHub secrets. Running `data-to-s3.yml` from another branch will fail to assume the role.

### Backend

- `terraform/api-gateway.tf` defines routes: `POST /log`, `GET /log`, `GET /userlog`, `POST /bulk`, `GET /name`, `POST /addname`, `POST /editname`, `GET /date` (POST routes also have `OPTIONS` routes for CORS). Each maps to a Lambda in `terraform/lambda_<name>/lambda_handler.py`, zipped by `archive_file` in `lambda.tf`. All eight are defined by one `local.lambdas` map in `lambda.tf` (directory, timeout, routes); that single entry drives the zip, function, API Gateway permission/integration/routes and the log group. Each Lambda also has its own least-privilege role built from the `lambda_access` map in `iam.tf` (one table, only the DynamoDB actions it uses, its own log group), so adding an endpoint means adding an entry to both maps (plus a handler directory). No Lambda uses the `activity` table.
- Lambdas build their own CORS response headers (`build_response`). Each `lambda_*/logger.py` is a symlink to `lambda_common/logger.py`; new lambdas should symlink it and call `log_event(event, context)`.
- DynamoDB tables (`dynamodb.tf`), all keyed by activity:
  - `names`: PK `activity_id`, SK `name_id`; attrs `display`, `filter` (age group).
  - `log`: PK `activity_id`, SK `log_id` = `<ISO date_time>#<name_id>` so a day's logs are fetched with `begins_with(log_id, "YYYY-MM-DD")`; attrs `direction` (`in`/`out`), `name_id`, `date_time`.
  - `activity`: PK `name_id` (= activity_id); sign-in/out time windows (`in_h_start`, … `out_m_end`) and `days_string`.
- `name_id` must be lowercase `a-z`, `0-9` and `_` only — see the sanitising logic in `scripts/import_names_csv.py`.

## Docs

`docs/requirements.md`, `docs/release_plan.md` and `docs/site_admin.md` describe product requirements, release plan, and season data reset/admin procedures. Past AI prompts used to build the pages are in `.github/co-pilot/`.
