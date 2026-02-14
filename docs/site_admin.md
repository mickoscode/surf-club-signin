 # Site Admin

The primary site, [sign-in-out.com](https://sign-in-out.com/) is only available during the "activity window".
Some features can be accessed/tested outside the window via:
- DEMO Activity (uses demo data, not prod data) - [sign-in-out.com/demo/](https://sign-in-out.com/demo/)
- Age Manager Activity Groups Page - [sign-in-out.com/age-manager/](https://sign-in-out.com/age-manager/)
- Age Manager History Page - [sign-in-out.com/history.html](https://sign-in-out.com/history.html)

## Utilities for managing data

Full data deletion & import (needed at the start of each season) - See helper scripts in scripts folder :)

Ad-hoc data admin (e.g. adding a missing name, correcting an existing name) - [sign-in-out.com/data/names.html](https://sign-in-out.com/data/names.html)

Viewing all names via front end - [sign-in-out.com/data/list-names.html](https://sign-in-out.com/data/list-names.html)

## Adding another club/group/activity - e.g. sorrento_redcaps_sunday
- Populate names table with list of allowed names for activity_id
- create new folder - e.g. `./web/reds`
- create ./web/reds/config.json
- create symbolic links for relevant files from ./reds/* to ../main/* 
- add `reds` to sync.sio.yml workflow

## Local Dev & Testing via vsCode LiveServer plugin

- Ensure LiveServer plugin installed via https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer&ssr=false#overview
- In vsCode, goto any html file and click "Go Live" option in footer menu to activate plugin (and determine ports, etc) and select to launch in browser
- URL may not be right / navigable, so manually goto necessary page - e.g. http://localhost:5500/web/main/index.html