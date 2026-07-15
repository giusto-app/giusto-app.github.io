#!/usr/bin/env bash
# Sync the vendored `lilyjs` package from the sibling lilyJS repo.
#
# The modern lilyjs bundle (parseSource → music-model Score, renderLily) is
# vendored because CI only checks out this repo. Longer term: publish lilyjs
# to npm and replace packages/lilyjs with a normal dependency.
#
# Usage: bash scripts/sync-lilyjs.sh
set -euo pipefail

GIUSTO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LILYJS_DIR="${LILYJS_DIR:-$GIUSTO_DIR/../lilyJS}"

if [ ! -f "$LILYJS_DIR/package.json" ]; then
  echo "lilyJS repo not found at $LILYJS_DIR (set LILYJS_DIR to override)" >&2
  exit 1
fi

echo "Building lilyjs bundle in $LILYJS_DIR ..."
(cd "$LILYJS_DIR" && bun run build:lilyjs)

echo "Copying bundle into packages/lilyjs/ ..."
mkdir -p "$GIUSTO_DIR/packages/lilyjs"
cp "$LILYJS_DIR/dist/lilyjs.esm.js" "$GIUSTO_DIR/packages/lilyjs/lilyjs.esm.js"

echo "Copying music fonts into public/lilyjs/fonts/ ..."
mkdir -p "$GIUSTO_DIR/public/lilyjs/fonts"
cp "$LILYJS_DIR/src/music-rendering/fonts/Bravura.woff2" \
   "$LILYJS_DIR/src/music-rendering/fonts/Academico.woff2" \
   "$GIUSTO_DIR/public/lilyjs/fonts/"

echo "Done. packages/lilyjs/index.d.ts is hand-maintained — update it if the API surface you use changed."
