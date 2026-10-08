# Front end developer guide

How the web pages are generated, how they load in the browser, and how `config.json` (especially `PAGES`) works.
Read this first if you need to make a significant change to the front end.

## The big idea

You edit **source** in `web/`. A build script turns it into **`dist/`**, which is exactly what gets uploaded to the S3 bucket.
The browser only ever sees `dist/`. There is no framework: each page is plain HTML plus a few plain scripts.

```
web/shared/  ──┐
web/youth/   ──┤                    ./scripts/build-sites.sh
web/am/      ──┼──► (copy + fill templates) ──►  dist/   ──► S3 ──► sign-in-out.com
web/demo/    ──┤                                  (not committed)
web/demo-am/ ──┤
web/data/    ──┘
```

## What each folder means

- **`web/shared/`** is everything common. It holds the page *templates* (`index`, `bulk`, `live`, `history`), the *scripts*
  (`common.js` plus one per page, and `static-page.js`), the stylesheets, the tab icons and the vendored libraries.
- **`web/youth`, `web/am`, `web/demo`, `web/demo-am`** are the four *views*. A view is one audience at one address.
  Youth is served at `/`, and the others at `/am/`, `/demo/` and `/demo-am/`. Each folder holds only what is unique to it:
  - `config.json`: the settings.
  - `header.snippet`: its one menu.
  - `info.html`: its guide page, which the menu label links to.
  - `404.html`: youth only (CloudFront's error page).
- **`web/data/`** holds the admin pages. They aren't a view and aren't templated; they are copied as they are.

## What `config.json` does

Each view's `config.json` has two kinds of entry.

**1. The `INJECT_*` values are pasted into templates.** A template contains placeholders like `{{INJECT_FAVICON}}` or
`data-activity-id="{{INJECT_ACTIVITY_ID}}"`. `scripts/inject-config.js` swaps each placeholder for the value in the config.
The page's scripts then read those values back from the `<body>` tag. This is how the same `live.template.html` becomes the
youth live page (real activity, test mode off) or the demo live page (activity `demo`, test mode on).

| Key | Meaning |
|---|---|
| `INJECT_PAGE_TITLE` | the browser tab title of the templated pages |
| `INJECT_API_URL` | the API the page talks to |
| `INJECT_FAVICON` | tab icon, a file name in `web/shared/icons/` (the build copies it into the view) |
| `INJECT_ACTIVITY_ID` | which activity's names and logs the page uses (`sorrento_youth_sunday` or `demo`) |
| `INJECT_ENABLE_TEST_MODE` | `"true"` lets `?test=in` / `?test=out` move the sign in window, so the demo works any day |
| `PAGES` | which pages the view has (below) |

**2. `PAGES` decides which pages the view gets, and where each comes from.** It is a map of *output page → template*:

```json
"PAGES": { "index": "bulk", "live": "live", "history": "history" }
```

The left side is the file name the visitor sees. The right side is which template and script it is built from.

- `"index": "bulk"` means *"build `index.html` from `bulk.template.html`, and give it `bulk.js`."* That is how `/am/` lands on
  the bulk sign-in page, while youth has `"index": "index"` and gets the single sign-in page.
- A page that isn't listed doesn't exist in that view. That's why there is no `bulk.html` anywhere, and why youth has no bulk
  sign-in.
- `PAGES` only adds *templated* pages. `info.html` and `404.html` are hand-written files in the view's folder, so they are not
  listed. A `PAGES` name must not clash with a hand-written file (the build fails if it does).

Current views:

| View | Served at | `PAGES` (output → template) | Own files |
|---|---|---|---|
| `youth` | `/` | index → index, live, history | `info.html`, `404.html` |
| `am` | `/am/` | index → **bulk**, live, history | `info.html` |
| `demo` | `/demo/` | index → index, live, history | `info.html` |
| `demo-am` | `/demo-am/` | index → **bulk**, live, history | `info.html` |

## What the build does, in order

`./scripts/build-sites.sh` starts by deleting `dist/`. Then, for each folder in `web/` that has a `config.json`
(the root view, `youth`, goes to `dist/`; the others to `dist/<folder>/`):

1. Copies in the shared files: `common.js`, `static-page.js`, the stylesheets and `vendor/`.
2. Copies the one tab icon named by `INJECT_FAVICON` from `web/shared/icons/`.
3. For each `PAGES` entry, copies `<template>.js` in and fills `<template>.template.html` from the config, writing it out as
   `<page>.html`.
4. Copies the view's own files on top: `header.snippet`, `info.html` and, for youth, `404.html`. It strips `config.json`, so
   configs and templates are never deployed.
5. Fails if a key is missing, a `{{INJECT_*}}` placeholder is left over, a page asks for a script or stylesheet that isn't
   there, or a `PAGES` name clashes with a hand-written file.

It then copies `web/data/` across and exits. CI runs the same script; merging to `main` uploads `dist/` to S3 (see
`.github/workflows/sync-sio.yml`).

## How a page loads in the browser

Take `/am/index.html` as the example:

1. The browser loads the HTML, which has an empty `<div id="header-container">`, the bulk form markup, and two scripts:
   `common.js`, then `bulk.js`.
2. `common.js` runs first and defines the shared helpers. It reads the `data-*` attributes from `<body>` to set `API_BASE`,
   `ACTIVITY_ID` and `ENABLE_TEST_MODE`.
3. `bulk.js` calls `loadMenu()`, which fetches `./header.snippet` and drops its HTML into `#header-container`. Every view has
   a different `header.snippet`, which is why the same code gives each view its own menu.
4. `bulk.js` then calls the API (`getJson` and `postJson`) and builds the page.

The scripts share one global scope, so a page script can use anything from `common.js`, and you mustn't redeclare its names
(`API_BASE`, `ACTIVITY_ID`, ...).

`info.html` and `404.html` are plain hand-written pages. They just load `common.js` and `static-page.js`, whose only job is
`loadMenu()`.

## Where to change things

| I want to... | Edit |
|---|---|
| Change how a page behaves (all views) | `web/shared/scripts/<page>.js` |
| Change a page's HTML layout (all views) | `web/shared/templates/<page>.template.html` |
| Change the look | `web/shared/styles/sign-in-out.css` (or `guide.css` for the info pages) |
| Change one view's menu | `web/<view>/header.snippet` |
| Change one view's settings (title, activity, test mode, icon) | `web/<view>/config.json` |
| Change what a view contains | `PAGES` in its `config.json` |
| Edit a guide | `web/<view>/info.html` |
| Add a whole new view | copy a view folder, edit its `config.json` and menu (the root view is `root_view` in the build script) |

## Working and testing locally

Never edit `dist/`: the build deletes and recreates it. After any change, run `./scripts/build-sites.sh`. Then either serve
the repo (for example with VS Code Live Server) and open `http://localhost:5500/dist/...`, or run the tests:

```bash
./scripts/build-sites.sh
npm ci --ignore-scripts
npm test                  # pages in jsdom against a fake API
npm run test:browser      # real Chromium with the site's enforced Content-Security-Policy
```

The demo views use the `demo` activity, so you can try things without touching real data. For example
`/dist/demo/index.html?test=in`.

## Things that bite

- Pages can't contain inline `<script>`, `onclick=` or `style=`. The site's CSP blocks them in the browser, and a test checks
  for them. Put code in a `.js` file and styles in a `.css` file.
- Browsers can cache files, which is why deploys send `Cache-Control: no-cache`. If you see odd behaviour right after a
  deploy, do a hard refresh.
- The redirects (`terraform/redirects.js`) and the CSP (`terraform/cloudfront.tf`) are outside this build. They change through
  Terraform (a gated apply), not through a site deploy.
- The session times (8:00am, 9:30am, 11:00am) live in `SESSION_TIMES` in `common.js`. The guides quote them, and a test checks
  they agree.
- One message-wording rule applies to everything a person reads: sentence case, no trailing full stop, no exclamation mark,
  times like "8:00am", button labels in Title Case. See `CLAUDE.md`.
