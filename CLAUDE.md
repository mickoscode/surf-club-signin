# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Paperless sign-in/out web app for surf club activities, live at sign-in-out.com. Static HTML/JS frontend hosted on S3 + CloudFront, serverless backend of API Gateway (HTTP API) → Python Lambdas → DynamoDB. Much of the config is hard-coded to one AWS account/environment (ap-southeast-2). The site itself has no build system or dependencies. The only `package.json` is dev tooling for the frontend tests (jsdom), and the only linting is `tflint`/`terraform fmt` on `terraform/`, run in CI.

## Commands

Build and validate every site at once (what CI runs; needs Node): `./scripts/build-sites.sh`. It fails on broken symlinks, missing `config.json` keys, or unreplaced `{{INJECT_*}}` placeholders. Note it regenerates the HTML in every site folder.

Frontend tests (Node 24; loads the generated pages into jsdom against a fake API, no network): run `./scripts/build-sites.sh` first, then `npm ci --ignore-scripts && npm test`. Tests live in `tests/web/` (`helpers.js` has `loadPage`, which fakes `fetch` and can freeze the clock; `fixtures.js` has sample data). CI runs them in `Validate sites`.

Generate HTML for a single site from templates (must run from inside the site folder — `inject-config.js` resolves paths from `process.cwd()` so symlinked copies work):

```bash
cd web/main && node ./inject-config.js          # index.html
node ./inject-config.js live                    # live.html (also: history, bulk)
```

Local dev: serve the repo with the VS Code Live Server extension and browse to e.g. `http://localhost:5500/web/main/index.html`. Pages call the real prod API URL from `config.json`; use `web/demo` (activity `demo`, test mode on) to avoid touching prod data.

Infrastructure (Terraform Cloud backend, org `mickoscode`, workspace `surf-club-signin`):

```bash
cd terraform && terraform plan -var-file=tfvars/prod.tfvars
cd terraform && terraform fmt -recursive && tflint --init && tflint   # same checks CI runs (config: terraform/.tflint.hcl)
```

Data admin scripts in `scripts/` shell out to the AWS CLI, e.g. `python3 scripts/import_names_csv.py <activity_id>` (expects `./names.csv`; `VALID_ACTIVITY_IDS` in the script must include the activity). `scripts/get-logs.bash <name_id> [--full]` queries the log table.

## Architecture

### Frontend: one shared template set, many "sites"

- `web/main/` holds the real templates (`*.template.html`), the page scripts, `inject-config.js`, CSS and `about.html`. **Edit `*.template.html` and the `.js` files, never the generated `index.html`/`live.html`/`history.html`/`bulk.html`** (generated files are gitignored).
- Page logic is in plain `<script src>` files, not inline: `common.js` (shared helpers: per-site settings, header loading, session window, date/time formatting, `getJson`/`postJson` with error handling, name/log row building, filter buttons) plus one script per page (`index.js`, `bulk.js`, `live.js`, `history.js`). Per-site settings reach the scripts as `data-api-url`, `data-activity-id` and `data-test-mode` attributes on `<body>`, written into each template by `inject-config.js`. A page's script always loads after `common.js`, so top-level names in the two share one global scope (don't redeclare `API_BASE`, `ACTIVITY_ID`, etc.). The `web/data/` pages follow the same rule with one script file each (`index.js`, `names.js`, `list-names.js`, `logs.js`) and `admin.css`/`index.css`; they hardcode the API URL and are not templated.
- Third-party assets (`picnic.min.css`, the Auth0 SDK) are vendored in `web/main/vendor/`, not loaded from a CDN; every site folder, `web/data` and `web/age-manager` has a `vendor` symlink to `../main/vendor`. See `docs/vendored_assets.md` for versions and how to update. A test fails if any page loads a script or stylesheet from another host.
- **No inline code anywhere in `web/`**: no inline `<script>`, `onclick=`-style handlers, `<style>` blocks or `style=` attributes (wire handlers with `addEventListener`, put styles in `.css` files). The site's Content-Security-Policy (`terraform/cloudfront.tf`, sent via CloudFront) allows only same-origin scripts and styles, so inline code would be blocked in the browser; `tests/web/csp.test.js` enforces this. The policy is enforced (`var.csp_enforce = true`; set it to `false` to fall back to `Content-Security-Policy-Report-Only`, which only logs violations to the browser console). If a page needs another host (a new API, CDN or Auth0 tenant), add it to `connect-src`/etc. in `cloudfront.tf`.
- `inject-config.js` replaces `{{KEY}}` placeholders with values from the folder's `config.json` (`INJECT_PAGE_TITLE`, `INJECT_API_URL`, `INJECT_FAVICON`, `INJECT_ACTIVITY_ID`, `INJECT_ENABLE_TEST_MODE`). Every key a template uses must exist in config.json.
- Each other folder (`demo`, and the age groups `pink`, `white`, `yellow`, `green`, `lblue`, `purple`, `dblue`, `red`) contains its own `config.json`, `header.snippet` and `header_leader.snippet`; everything else (templates, the `.js` files, CSS, `about.html`, `inject-config.js`) is a **symlink to `../main/`**. Pages `fetch('./header.snippet')` at runtime to get a per-site nav menu.
- `INJECT_ENABLE_TEST_MODE: "true"` (demo) enables the test/demo behaviour (e.g. bypassing the activity time window).
- `web/data/` (name admin pages) and `web/age-manager/` are standalone pages, not templated.

Adding a new activity site: populate the `names` table for the new `activity_id`, create `web/<x>/` with `config.json` + snippets + symlinks to `../main/*` (including `common.js`, `index.js`, `bulk.js`, `live.js`, `history.js` and the `vendor` directory; `build-sites.sh` fails if a page's script or stylesheet is missing), and add `<x>` to `VALID_ACTIVITY_IDS` in `scripts/import_names_csv.py`. CI discovers sites automatically (any `web/<folder>/` with a `config.json`), so no workflow edits are needed.

### Deployment

All workflows live in `.github/workflows/`; third-party actions are pinned to commit SHAs (Dependabot updates them weekly).

- `sync-sio.yml` (frontend) runs on push to `main`: runs `scripts/build-sites.sh`, `aws s3 sync`s `web/main` to the bucket root and each other folder to `/<folder>`, then invalidates CloudFront (one `/*` invalidation). Merging to main deploys to prod.
- `web-pr.yml` runs on PRs that touch the frontend and runs the same `scripts/build-sites.sh`; it also runs the frontend tests, and `Validate sites` can be a required check (skipped, not absent, when `web/` is unchanged).
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
