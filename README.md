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

- Each activity (e.g. a surf club age group) is a "site": a folder under [./web/](./web/) with its own `config.json` and menu, sharing one set of page templates.
- People sign in/out on `index.html` during the activity window. Leaders use `bulk.html` (sign in/out a whole group at once), `live.html` (a live count of who has signed in) and `history.html`.
- The sign-in times are currently hard coded in the pages (08:00 in, 09:30 out, 11:00 end, Sundays only); the demo site ignores them in test mode.

## Repo Overview

[./web/main/](./web/main/) - the shared templates for every site:
- [config.json](./web/main/config.json) - values injected into the html templates (page title, API URL, favicon, activity id, test mode)
- [header.snippet](./web/main/header.snippet) / [header_leader.snippet](./web/main/header_leader.snippet) - the menu for users and for leaders; each site can have its own copy
- `index.template.html`, `bulk.template.html`, `live.template.html`, `history.template.html` - [inject-config.js](./web/main/inject-config.js) turns these into the `.html` pages (the generated pages are not committed). The templates contain markup only; the page logic is in [common.js](./web/main/common.js) (shared helpers) and one script per page (`index.js`, `bulk.js`, `live.js`, `history.js`)
- [about.html](./web/main/about.html), [sign-in-out.css](./web/main/sign-in-out.css) - shared as-is

Other site folders: [./web/demo/](./web/demo/) plus the age groups `pink`, `white`, `yellow`, `green`, `lblue`, `purple`, `dblue` and `red`:
- Everything except `config.json` and the two `.snippet` files (templates, scripts, CSS) is a symbolic link back to [./web/main/](./web/main/)
- `"INJECT_ENABLE_TEST_MODE": "true"` in config.json (demo only) enables the test/demo functionality, e.g. `index.html?test=in` or `?test=out`. Use the demo site so you don't touch real data.

Standalone pages (not templated): [./web/data/](./web/data/) (manage names and view logs) and [./web/age-manager/](./web/age-manager/) (one page linking to each age group's bulk and single sign-in).

> **Security note:** the API has no authentication, so the admin pages in `web/data/` are only hidden, not protected. This is a known, accepted risk for now.

[./tests/web/](./tests/web/) - frontend tests, see [Local development](#local-development).

[./scripts/](./scripts/):
- [build-sites.sh](./scripts/build-sites.sh) - builds and validates every site (what CI runs)
- Python scripts to simplify basic web-dev site admin via AWS cli (e.g. importing names)
- Plan is to build authentication and site driven admin, if more people want to create activities

[./terraform/](./terraform/):
- Code to build all of the aws resources (s3 bucket, cloudfront, api gateway with throttling, one least-privilege IAM role per lambda, lambdas, dynamodb with point-in-time recovery, certs, cloudwatch alarms, browser security headers including a Content-Security-Policy, a cost budget alert, and the GitHub OIDC deploy role)
- Runs in HCP Terraform (org `mickoscode`, workspace `surf-club-signin`)
- Targets a single environment and default VPC
- Not super re-usable in it's current state, but plan to clean this up in future releases
- The budget alert email address is not in the repo: set the sensitive workspace variable `budget_alert_email`

## Local development

Pages call the real API, so use [./web/demo/](./web/demo/) for manual testing.

```bash
./scripts/build-sites.sh          # generate the pages (needs Node 24)
# serve the repo (e.g. VS Code Live Server) and browse to http://localhost:5500/web/demo/index.html?test=in

npm ci --ignore-scripts           # one-off: installs jsdom, used only by the tests
npm test                          # frontend tests: real pages in jsdom against a fake API
npx playwright install chromium   # one-off: the browser for the next command (on Linux add --with-deps)
npm run test:browser              # real Chromium, with the site's enforced Content-Security-Policy
```

Edit the `*.template.html` files and the `.js` files in `web/main/`, never the generated `index.html`, `live.html`, `history.html` or `bulk.html`.

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

- [requirements.md](./docs/requirements.md), [release_plan.md](./docs/release_plan.md) - what the site is for and how it is rolled out
- [site_admin.md](./docs/site_admin.md) - season reset and other admin procedures
- [go_live_prep.md](./docs/go_live_prep.md) - pre-launch checklist for the first season
- [vendored_assets.md](./docs/vendored_assets.md) - the CSS/JS libraries served from this repo instead of a CDN, and how to update them
- [CLAUDE.md](./CLAUDE.md) - detailed architecture and conventions (also used by AI coding assistants)
