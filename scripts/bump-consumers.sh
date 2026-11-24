#!/usr/bin/env bash
# Point every TapSleek app at the card engine's latest pushed commit.
# Run locally from the card-engine repo after pushing an engine change:
#
#   bash scripts/bump-consumers.sh           # bump, install, typecheck, commit
#   bash scripts/bump-consumers.sh --push    # ...and push each app
#
# Then deploy each app on the server with `bash scripts/deploy.sh`.
# The apps live next to the Packages folder:  <root>/Packages/card-engine.tapsleek.com
#                                             <root>/api.tapsleek.com, app..., card..., ...
set -euo pipefail
cd "$(dirname "$0")/.."

PUSH=0
[ "${1:-}" = "--push" ] && PUSH=1

ROOT="$(cd ../.. && pwd)"
APPS=(api.tapsleek.com app.tapsleek.com card.tapsleek.com admin.tapsleek.com apk.tapsleek.com)

# Only a commit that GitHub has can be installed by the apps and the server.
git fetch -q origin
NEW=$(git rev-parse HEAD)
if ! git merge-base --is-ancestor "$NEW" origin/main; then
  echo "✗ Engine commit ${NEW:0:7} isn't on origin/main yet — push the engine first." >&2
  exit 1
fi
if [ -n "$(git status --porcelain -- src dist dist-esm)" ]; then
  echo "✗ Engine has uncommitted changes in src/dist — build, commit and push them first." >&2
  exit 1
fi
echo "▸ Card engine → ${NEW:0:7}"

for app in "${APPS[@]}"; do
  dir="$ROOT/$app"
  if [ ! -f "$dir/package.json" ]; then
    echo "  – $app: not found, skipped"
    continue
  fi
  (
    cd "$dir"
    OLD=$(node -e 'const v=require("./package.json").dependencies["@tapsleek/card-engine"]||"";console.log(v.split("#")[1]||"")')
    if [ -z "$OLD" ]; then
      echo "  – $app: doesn't pin the engine, skipped"
      exit 0
    fi
    if [ "$OLD" = "$NEW" ]; then
      echo "  ✓ $app: already on ${NEW:0:7}"
      exit 0
    fi
    if [ -n "$(git status --porcelain -- package.json pnpm-lock.yaml)" ]; then
      echo "  ✗ $app: package.json or pnpm-lock.yaml has local changes, skipped" >&2
      exit 0
    fi

    echo "▸ $app: ${OLD:0:7} → ${NEW:0:7}"
    sed -i "s/card-engine.tapsleek.com#${OLD}/card-engine.tapsleek.com#${NEW}/" package.json
    pnpm install > /dev/null

    if node -e 'process.exit(require("./package.json").scripts?.typecheck ? 0 : 1)'; then
      pnpm typecheck > /dev/null
    else
      npx tsc --noEmit -p tsconfig.json > /dev/null
    fi

    git add package.json pnpm-lock.yaml
    git commit -q -m "Bump card-engine to ${NEW:0:7}"
    if [ "$PUSH" = 1 ]; then
      git push -q
      echo "  ✓ $app: committed and pushed"
    else
      echo "  ✓ $app: committed (not pushed)"
    fi
  )
done

echo "Done. Deploy each app on the server: bash scripts/deploy.sh"
