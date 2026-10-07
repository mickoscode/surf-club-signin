 # Site Admin

The primary site, [sign-in-out.com](https://sign-in-out.com/) is only available during the "activity window".
Some features can be accessed/tested outside the window via:
- DEMO Activity (uses demo data, not prod data) - [sign-in-out.com/demo/](https://sign-in-out.com/demo/)
- Age Manager guide (how bulk sign in works, signing in one youth, practising on the demo) - [sign-in-out.com/age-manager/](https://sign-in-out.com/age-manager/)
- Age Manager History Page - [sign-in-out.com/history.html](https://sign-in-out.com/history.html)

## Utilities for managing data

Full data deletion & import (needed at the start of each season) - See helper scripts in scripts folder :)

Data admin home (menu to all of the pages below) - [sign-in-out.com/data/](https://sign-in-out.com/data/)

Ad-hoc data admin (e.g. adding a missing name, correcting an existing name) - [sign-in-out.com/data/names.html](https://sign-in-out.com/data/names.html)

Viewing all names via front end - [sign-in-out.com/data/list-names.html](https://sign-in-out.com/data/list-names.html)

## Adding another club/group/activity - e.g. sorrento_redcaps_sunday
Youth is currently the only active team (the colour age-group sites were removed), but another can be added:
- Populate the names table with the list of allowed names for the new activity_id
- Copy the demo folder (keeps its symbolic links): `cp -a web/demo web/reds`
- Edit `./web/reds/config.json` (activity id, page title, `"INJECT_ENABLE_TEST_MODE": "false"`) and the two `.snippet` menus
- Add the activity id to `VALID_ACTIVITY_IDS` in `scripts/import_names_csv.py` and `scripts/delete_all_log_history.py`, to `VALID_ACTIVITY_ID` in `web/data/names.js` and `web/data/list-names.js`, and to the links in `web/data/list-names.html`
- Add the new activity's links to `web/age-manager/index.html` (the guide currently covers Youth and Demo)
- No workflow changes are needed: CI and the deploy find sites by their `config.json`

## Local Dev & Testing via vsCode LiveServer plugin

- Remember to edit **template** files, not index.html, history.html, etc
- After editing template files, re-generate html. e.g. cd web/main; node ./inject-config.js bulk (see gen-html alias)
- Ensure LiveServer plugin installed via https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer&ssr=false#overview
- In vsCode, goto any html file and click "Go Live" option in footer menu to activate plugin (and determine ports, etc) and select to launch in browser
- URL may not be right / navigable, so manually goto necessary page - e.g. http://localhost:5500/web/main/index.html

## name_id format / generation

- name_id should only have lower case ascii a-z, 0-9 and underscores
- see scripts/import_names_csv.py for implementation