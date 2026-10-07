#!/usr/bin/env bash
# Generate the HTML pages for every site and fail on common problems.
#
# A "site" is any web/<folder>/ that contains a config.json (web/main plus the
# per-activity folders). web/data and web/age-manager have none, so they are skipped.
# Used by CI (PR validation and deploy); safe to run locally.
#
# Checks per site: no broken symlinks, valid config.json with every INJECT_ key,
# header snippets present, no unreplaced {{INJECT_*}} placeholders in the output, and every
# local <script src> and stylesheet the pages load exists in the site folder.
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
pages=(index live history bulk about)
required_keys=(INJECT_PAGE_TITLE INJECT_API_URL INJECT_FAVICON INJECT_FAVICON_LEADER INJECT_ACTIVITY_ID INJECT_ENABLE_TEST_MODE)
failed=0

fail() {
  echo "::error::web/$site: $1"
  failed=1
}

for cfg in "$repo_root"/web/*/config.json; do
  dir=$(dirname "$cfg")
  site=$(basename "$dir")
  echo "== $site"

  broken=$(find "$dir" -maxdepth 1 -xtype l)
  if [ -n "$broken" ]; then
    fail "broken symlink(s): $(echo "$broken" | xargs -n1 basename | tr '\n' ' ')"
    continue
  fi

  for f in header.snippet header_leader.snippet; do
    [ -f "$dir/$f" ] || fail "missing $f"
  done

  if ! python3 - "$cfg" "${required_keys[@]}" <<'PY'
import json, sys
cfg, keys = sys.argv[1], sys.argv[2:]
try:
    data = json.load(open(cfg))
except ValueError as e:
    sys.exit(f"config.json is not valid JSON: {e}")
missing = [k for k in keys if not data.get(k)]
if missing:
    sys.exit("config.json missing keys: " + ", ".join(missing))
PY
  then
    fail "invalid config.json (see above)"
    continue
  fi

  for page in "${pages[@]}"; do
    (cd "$dir" && node ./inject-config.js "$page") >/dev/null
    left=$(grep -o '{{INJECT_[A-Z_]*}}' "$dir/$page.html" | sort -u | tr '\n' ' ' || true)
    [ -z "$left" ] || fail "$page.html has unreplaced placeholders: $left"

    # every local <script src="..."> and stylesheet must exist in this site folder (a missing symlink would ship a broken page)
    for src in $(grep -oE '(<script src|<link rel="stylesheet" href)="[^"]+"' "$dir/$page.html" | sed -E 's/.*"([^"]+)"$/\1/' | grep -vE '^(https?:)?//' || true); do
      [ -f "$dir/$src" ] || fail "$page.html loads $src, which is missing from the site folder (add a symlink to ../main/$(echo "${src#./}" | cut -d/ -f1))"
    done
  done
done

exit "$failed"
