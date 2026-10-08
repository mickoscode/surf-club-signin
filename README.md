# surf-club-signin
Simple website to enable paperless sign-in-out for surf club activities.

This website is hosted in aws s3 + cloudfront, using API Gateway for serverless backend (lambda & dynamodb).

## Project Context

The aims of this repo/project are:
1. Build a useful web app that will reduce paper waste when I facilitate surf club activities that require sign in/out.
2. Practice AI assisted coding - see [ai prompts](./.github/co-pilot/)
   - These prompts were used initiatlly in building pre releases via free-tier AI chats, but are effectively relics of 2025.
   - Claude sonnet was used for all PRs included in v1.0.0

See [requirements.md](./docs/requirements.md) and [release_plan.md](./docs/release_plan.md) for more context on how this website project was initially planned out.

## How it works

```
browser ──> CloudFront ──> S3 (static html/js/css)
   │
   └──────> API Gateway (HTTP API, throttled) ──> Python Lambdas ──> DynamoDB (names, log, activity)
```

- Youth Sunday sessions (`sorrento_youth_sunday`) are the only active team and are served from the top level of the domain. Age managers use their own view at `/am/` (bulk sign in/out and a guide). A practice copy of each, with its own demo data, is at `/demo/` (youth) and `/demo-am/` (age managers), for testing and for learning how the site works.
- Each of these is a "view": a folder under [./web/](./web/) with its own `config.json` and menu, sharing one set of page templates. Adding another team later is a folder copy (see [site_admin.md](./docs/site_admin.md)).
- Youth sign in/out on `index.html` during the activity window, and everyone can see `live.html` (a live count of who has signed in) and `history.html` from the menu. Age managers have their own pages at `/am/`: `index.html` (bulk: sign in/out a whole group at once), the same live count and history, and a guide. Every view has an `info.html`, opened from the label at the left of its menu (YOUTH, AM, DEMO-Y, DEMO-A).
- The sign-in times are currently hard coded in the pages (08:00 in, 09:30 out, 11:00 end, Sundays only); the demo site ignores them in test mode.

## Repo Overview

Under [./web/](./web/), each folder is either common code or one view that serves one audience, with one menu and one tab icon:

| Folder | Served at | What is in it |
|---|---|---|
| [web/shared/](./web/shared/) | (copied into every view) | Everything common: the page templates (`templates/`), the page scripts (`scripts/`: `common.js` shared helpers, one script per page), the stylesheets (`styles/`), the tab icons (`icons/`) and the vendored libraries (`vendor/`) |
| [web/youth/](./web/youth/) | `/` (the site root) | Youth signing themselves in and out. Only what is unique: `config.json` (page title, API URL, tab icon, activity id, test mode, which pages), the menu (`header.snippet`), `info.html` (the Youth Sign-in-out Guide) and the `404.html` page CloudFront shows for any address that doesn't exist |
| [web/am/](./web/am/) | `/am/` | Age managers: bulk sign in/out (`index.html`), live count, history, and `info.html`, a plain-language guide (the red **AM** in the menu links to it) |
| [web/demo/](./web/demo/) | `/demo/` | A practice copy of the youth view using the `demo` activity; `"INJECT_ENABLE_TEST_MODE": "true"` enables the test/demo functionality, e.g. `index.html?test=in` or `?test=out`, so you don't touch real data. `info.html` explains it (the **DEMO-Y** in the menu links to it) |
| [web/demo-am/](./web/demo-am/) | `/demo-am/` | A practice copy of the age manager view (bulk sign in/out at `index.html`); `info.html` explains it (the **DEMO-A** in the menu links to it) |
| [web/data/](./web/data/) | `/data/` | The name admin pages (manage names, view logs). Standalone; they load the shared stylesheet and libraries from the site root |

[scripts/build-sites.sh](./scripts/build-sites.sh) assembles these into `dist/` (not committed), which is laid out exactly like the S3 bucket: for each view it copies in the shared scripts, stylesheets, icon and libraries it needs, adds the view's own files, and fills each template listed in the view's `config.json` (`PAGES`) ([inject-config.js](./scripts/inject-config.js)) to make pages such as `index.html`, `bulk.html`, `live.html`, `history.html` and `about.html`. The templates contain markup only; the page logic is in `common.js` and one script per page (`index.js`, `bulk.js`, `live.js`, `history.js`; `static-page.js` for the about page).

> **Security note:** the API has no authentication, so the admin pages in `web/data/` are only hidden, not protected. This is a known, accepted risk for now.

[./tests/web/](./tests/web/) - frontend tests, see [Local development](#local-development).

[./scripts/](./scripts/):
- [build-sites.sh](./scripts/build-sites.sh) - assembles and validates the whole site into `dist/` (what CI runs and what is deployed); [inject-config.js](./scripts/inject-config.js) is the template filler it uses
- Python scripts to simplify basic web-dev site admin via AWS cli (e.g. importing names)
- Plan is to build authentication and site driven admin, if more people want to create activities

[./terraform/](./terraform/):
- Code to build all of the aws resources (s3 bucket, cloudfront, api gateway with throttling, one least-privilege IAM role per lambda, lambdas, dynamodb with point-in-time recovery, certs, cloudwatch alarms, browser security headers including a Content-Security-Policy, a cost budget alert, and the GitHub OIDC deploy role)
- Runs in HCP Terraform (org `mickoscode`, workspace `surf-club-signin`)
- Targets a single environment and default VPC
- Not super re-usable in it's current state, but plan to clean this up in future releases
- The budget alert email address is not in the repo: set the sensitive workspace variable `budget_alert_email`

## Local development

Pages call the real API, so use the demo ([./web/demo/](./web/demo/)) for manual testing.

```bash
./scripts/build-sites.sh          # assemble the site into dist/ (needs Node 24)
# serve the repo (e.g. VS Code Live Server) and browse to http://localhost:5500/dist/demo/index.html?test=in

npm ci --ignore-scripts           # one-off: installs jsdom, used only by the tests
npm test                          # frontend tests: real pages in jsdom against a fake API
npx playwright install chromium   # one-off: the browser for the next command (on Linux add --with-deps)
npm run test:browser              # real Chromium, with the site's enforced Content-Security-Policy
```

Edit the files under `web/` (templates and scripts in `web/shared/`), never the generated `dist/`; run `./scripts/build-sites.sh` again after each change.

Infrastructure:

```bash
cd terraform && terraform plan -var-file=tfvars/prod.tfvars
cd terraform && terraform fmt -recursive && tflint --init && tflint
```

## CI / deployment

GitHub Actions workflows are in [./.github/workflows/](./.github/workflows/). Actions are pinned to commit SHAs and updated by Dependabot. AWS access uses GitHub OIDC (no stored AWS keys).

| Workflow | When | What |
|---|---|---|
| `web-pr.yml` | PRs touching the frontend (or the CSP in `terraform/cloudfront.tf`) | builds all sites, then runs the jsdom tests and the real-browser (Playwright) tests |
| `sync-sio.yml` | push to `main` | builds the sites, syncs them to S3 and invalidates CloudFront. **Merging to main deploys the website.** |
| `terraform-pr.yml` | PRs touching `terraform/` | fmt, validate, tflint, Trivy security scan and a plan posted as a PR comment |
| `terraform-apply.yml` | push to `main` touching `terraform/` | plan, then an apply that waits for manual approval in the `terraform-production` environment |
| `terraform-drift.yml` | weekly | fails if live AWS differs from the code (never applies) |
| `data-to-s3.yml` | manual | pushes only `web/data` |
| `delete-merged-branch.yml` | PR merged | deletes the PR's branch (same-repo branches only, never `main`) |

`main` is protected by a ruleset: changes go through a PR with the checks above passing.

## Documentation

- [frontend-dev-guide.md](./docs/frontend-dev-guide.md) - how the pages are generated and loaded, and how `config.json` / `PAGES` work (start here before changing the front end)
- [requirements.md](./docs/requirements.md), [release_plan.md](./docs/release_plan.md) - what the site is for and how it is rolled out
- [site_admin.md](./docs/site_admin.md) - season reset and other admin procedures
- [go_live_prep.md](./docs/go_live_prep.md) - pre-launch checklist for the first season
- [vendored_assets.md](./docs/vendored_assets.md) - the CSS/JS libraries served from this repo instead of a CDN, and how to update them
- [CLAUDE.md](./CLAUDE.md) - detailed architecture and conventions (also used by AI coding assistants)
