#!/usr/bin/env bash
# Assemble the whole website into dist/ (exactly what is deployed to the S3 bucket) and fail on common problems.
#
# web/ holds the source, split by who owns it:
#   web/shared/       code and assets common to the templated views (youth and demo): page templates,
#                     scripts, stylesheet, vendored libraries
#   web/youth/        what is unique to the Youth view: config.json, menus, icons, 404 page. Served at the site root.
#   web/demo/         what is unique to the Demo view: config.json, menus, icon. Served at /demo/.
#   web/age-manager/  the age manager guide (a standalone page). Served at /age-manager/.
#   web/data/         the name admin pages (standalone). Served at /data/.
#
# A templated view is any web/<folder>/ with a config.json. For each one the build copies web/shared/ in, then the
# view's own files on top, then fills the page templates from its config.json. age-manager and data are copied as
# they are. The pages of those two link up to the shared files in the site root (../common.js, ../vendor/).
# Used by CI (PR validation and deploy); safe to run locally. dist/ is not committed.
#
# Checks per view: valid config.json with every INJECT_ key, menus present, no unreplaced {{INJECT_*}}
# placeholders in the output, and every local <script src> and stylesheet a page loads exists in dist.
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
web="$repo_root/web"
dist="$repo_root/dist"
root_view=youth                 # the view served at the site root; every other view is served at /<folder>/
pages=(index live history bulk about)
required_keys=(INJECT_PAGE_TITLE INJECT_API_URL INJECT_FAVICON INJECT_ACTIVITY_ID INJECT_ENABLE_TEST_MODE)
failed=0

fail() {
  echo "::error::$1"
  failed=1
}

# every local <script src> and stylesheet in $2 (a page inside the dist folder $1) must exist
check_assets() {
  local dir=$1 file=$2 src
  for src in $(grep -oE '(<script src|<link rel="stylesheet" href)="[^"]+"' "$file" | sed -E 's/.*"([^"]+)"$/\1/' | grep -vE '^(https?:)?//' || true); do
    [ -f "$(dirname "$file")/$src" ] || fail "${file#"$dist"/} loads $src, which is not in dist (is it in web/shared/ or the view's own folder?)"
  done
}

rm -rf "$dist"
mkdir -p "$dist"

for cfg in "$web"/*/config.json; do
  view=$(basename "$(dirname "$cfg")")
  src="$web/$view"
  if [ "$view" = "$root_view" ]; then out="$dist"; else out="$dist/$view"; fi
  echo "== $view -> ${out#"$repo_root"/}/"

  for f in header.snippet header_leader.snippet; do
    [ -f "$src/$f" ] || fail "web/$view: missing $f"
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
    fail "web/$view: invalid config.json (see above)"
    continue
  fi

  mkdir -p "$out"
  cp -R "$web/shared/scripts/." "$web/shared/styles/." "$out/"
  cp -R "$web/shared/vendor" "$out/vendor"
  cp -R "$src/." "$out/"
  rm "$out/config.json"

  for page in "${pages[@]}"; do
    node "$repo_root/scripts/inject-config.js" "$cfg" "$web/shared/templates/$page.template.html" "$out/$page.html"
    left=$(grep -o '{{INJECT_[A-Z_]*}}' "$out/$page.html" | sort -u | tr '\n' ' ' || true)
    [ -z "$left" ] || fail "web/$view: $page.html has unreplaced placeholders: $left"
    check_assets "$out" "$out/$page.html"
  done
done

for view in age-manager data; do
  echo "== $view -> dist/$view/"
  mkdir -p "$dist/$view"
  cp -R "$web/$view/." "$dist/$view/"
  for page in "$dist/$view"/*.html; do check_assets "$dist/$view" "$page"; done
done

exit "$failed"
