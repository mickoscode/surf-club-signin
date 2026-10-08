# Assemble the whole website into dist/ (exactly what is deployed to the S3 bucket) and fail on common problems.
#
# web/ holds the source, split by who owns it:
#   web/shared/   code and assets common to the views: page templates, scripts, stylesheets, icons, vendored libraries
#   web/youth/    the Youth view (people signing themselves in and out). Served at the site root.
#   web/am/       the Age Manager view (bulk sign in, plus the guide). Served at /am/.
#   web/demo/     practice copy of the Youth view, using the "demo" activity. Served at /demo/.
#   web/demo-am/  practice copy of the Age Manager view. Served at /demo-am/.
#   web/data/     the name admin pages (standalone, not a view). Served at /data/.
#
# A view is any web/<folder>/ with a config.json. It holds only what is unique to it: the config (page title, API URL,
# icon, activity, test mode and which pages it has), its one menu (header.snippet) and any pages of its own (a guide).
# For each view the build copies the shared scripts, stylesheets, vendored libraries and the view's icon in, then the
# view's own files on top, then fills each listed page template from the config. data is copied as it is.
# Used by CI (PR validation and deploy); safe to run locally. dist/ is not committed.
#
# Checks per view: valid config.json with every key, a menu, no unreplaced {{INJECT_*}} placeholders in the output,
# and every local <script src> and stylesheet a page loads exists in dist.
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
web="$repo_root/web"
dist="$repo_root/dist"
root_view=youth                 # the view served at the site root; every other view is served at /<folder>/
required_keys=(INJECT_PAGE_TITLE INJECT_API_URL INJECT_FAVICON INJECT_ACTIVITY_ID INJECT_ENABLE_TEST_MODE PAGES)
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

  [ -f "$src/header.snippet" ] || fail "web/$view: missing header.snippet (the view's menu)"

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
  icon=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["INJECT_FAVICON"])' "$cfg")
  pages=$(python3 -c 'import json,sys; print(" ".join(json.load(open(sys.argv[1]))["PAGES"]))' "$cfg")
  if [ ! -f "$web/shared/icons/$icon" ]; then
    fail "web/$view: INJECT_FAVICON $icon is not in web/shared/icons/"
    continue
  fi

  mkdir -p "$out"
  cp "$web/shared/styles/"* "$out/"
  cp "$web/shared/scripts/common.js" "$web/shared/scripts/static-page.js" "$out/"   # static-page.js: the menu on the about page and guides
  cp -R "$web/shared/vendor" "$out/vendor"
  cp "$web/shared/icons/$icon" "$out/"
  cp -R "$src/." "$out/"
  rm "$out/config.json"

  for page in $pages; do
    [ ! -e "$src/$page.html" ] || fail "web/$view: $page.html is both a page of the view's own and one generated from a template"
    [ "$page" = about ] || cp "$web/shared/scripts/$page.js" "$out/"
    node "$repo_root/scripts/inject-config.js" "$cfg" "$web/shared/templates/$page.template.html" "$out/$page.html"
    left=$(grep -o '{{INJECT_[A-Z_]*}}' "$out/$page.html" | sort -u | tr '\n' ' ' || true)
    [ -z "$left" ] || fail "web/$view: $page.html has unreplaced placeholders: $left"
  done
  # the generated pages and the view's own pages (guides, 404) all load shared files
  for page in "$out"/*.html; do check_assets "$out" "$page"; done
done

echo "== data -> dist/data/"
mkdir -p "$dist/data"
cp -R "$web/data/." "$dist/data/"
for page in "$dist/data"/*.html; do check_assets "$dist/data" "$page"; done

exit "$failed"
