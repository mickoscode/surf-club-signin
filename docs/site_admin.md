 # Site Admin

The primary site, [sign-in-out.com](https://sign-in-out.com/) is only available during the "activity window".
Some features can be accessed/tested outside the window via:
- DEMO Activity (uses demo data, not prod data) - [sign-in-out.com/demo/](https://sign-in-out.com/demo/)
- DEMO Age Manager (practise bulk sign in/out) - [sign-in-out.com/demo-am/](https://sign-in-out.com/demo-am/)
- Age Manager guide (how bulk sign in works, practising on the demo) - [sign-in-out.com/am/](https://sign-in-out.com/am/)
- Age Manager History Page - [sign-in-out.com/am/history.html](https://sign-in-out.com/am/history.html)

## Utilities for managing data

Full data deletion & import (needed at the start of each season) - See helper scripts in scripts folder :)

Data admin home (menu to all of the pages below) - [sign-in-out.com/data/](https://sign-in-out.com/data/)

Ad-hoc data admin (e.g. adding a missing name, correcting an existing name) - [sign-in-out.com/data/names.html](https://sign-in-out.com/data/names.html)

Viewing all names via front end - [sign-in-out.com/data/list-names.html](https://sign-in-out.com/data/list-names.html)

## Adding another club/group/activity - e.g. sorrento_redcaps_sunday
Youth is currently the only active team (the colour age-group sites were removed), but another can be added:
- Populate the names table with the list of allowed names for the new activity_id
- Copy the youth and age manager folders: `cp -R web/youth web/reds` and `cp -R web/am web/reds-am` (each holds only a config, a menu and its own pages; everything else comes from `web/shared/`)
- Edit `./web/reds/config.json` (activity id, page title, `"INJECT_ENABLE_TEST_MODE": "false"`) and the menus (`header.snippet`)
- Add the activity id to `VALID_ACTIVITY_IDS` in `scripts/import_names_csv.py` and `scripts/delete_all_log_history.py`, to `VALID_ACTIVITY_ID` in `web/data/names.js` and `web/data/list-names.js`, and to the links in `web/data/list-names.html`
- Add the new activity's links to `web/am/index.html` (the guide currently covers Youth)
- No workflow changes are needed: CI and the deploy find sites by their `config.json`

## Local Dev & Testing via vsCode LiveServer plugin

- Edit the source under `web/` (templates and scripts are in `web/shared/`), never the generated `dist/`
- After editing, rebuild: `./scripts/build-sites.sh` (needs Node; it assembles the whole site into `dist/`)
- Ensure LiveServer plugin installed via https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer&ssr=false#overview
- In vsCode, goto any html file and click "Go Live" option in footer menu to activate plugin (and determine ports, etc) and select to launch in browser
- URL may not be right / navigable, so manually goto necessary page - e.g. http://localhost:5500/dist/index.html (Youth) or http://localhost:5500/dist/demo/index.html?test=in
