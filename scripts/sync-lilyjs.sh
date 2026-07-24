#!/usr/bin/env bash
# Sync the vendored `lilyjs` package from the sibling lilyJS repo.
#
# The modern lilyjs bundle (parseSource → music-model Score, renderLily) is
# vendored because CI only checks out this repo. Longer term: publish lilyjs
# to npm and replace packages/lilyjs with a normal dependency.
#
# Low-level copier used by sync-lilyjs-release.sh. For normal local updates,
# run `bun run sync:lilyjs` so the build comes from an isolated release tag.
set -euo pipefail

GIUSTO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LILYJS_DIR="${LILYJS_DIR:-$GIUSTO_DIR/../lilyJS}"
LILYJS_REPOSITORY="${LILYJS_REPOSITORY:-MarcMouries/lilyJS}"

if [ ! -f "$LILYJS_DIR/package.json" ]; then
  echo "lilyJS repo not found at $LILYJS_DIR (set LILYJS_DIR to override)" >&2
  exit 1
fi

echo "Building lilyjs bundle in $LILYJS_DIR ..."
(cd "$LILYJS_DIR" && bun run build:lilyjs)

echo "Copying bundle into packages/lilyjs/ ..."
mkdir -p "$GIUSTO_DIR/packages/lilyjs"
cp "$LILYJS_DIR/dist/lilyjs.esm.js" "$GIUSTO_DIR/packages/lilyjs/lilyjs.esm.js"

LILYJS_COMMIT="$(git -C "$LILYJS_DIR" rev-parse HEAD)"
LILYJS_TAG="${LILYJS_TAG:-$(git -C "$LILYJS_DIR" describe --tags --exact-match 2>/dev/null || true)}"
TAG_JSON=null
if [ -n "$LILYJS_TAG" ]; then TAG_JSON="\"$LILYJS_TAG\""; fi
printf '{\n  "repository": "%s",\n  "tag": %s,\n  "commit": "%s"\n}\n' \
  "$LILYJS_REPOSITORY" "$TAG_JSON" "$LILYJS_COMMIT" \
  > "$GIUSTO_DIR/packages/lilyjs/upstream.json"

echo "Copying music fonts into public/lilyjs/fonts/ ..."
mkdir -p "$GIUSTO_DIR/public/lilyjs/fonts"
cp "$LILYJS_DIR/src/music-rendering/fonts/Bravura.woff2" \
   "$LILYJS_DIR/src/music-rendering/fonts/Academico.woff2" \
   "$LILYJS_DIR/src/music-rendering/fonts/TeXGyreSchola-Regular.woff2" \
   "$LILYJS_DIR/src/music-rendering/fonts/TeXGyreSchola-Bold.woff2" \
   "$LILYJS_DIR/src/music-rendering/fonts/TeXGyreSchola-Italic.woff2" \
   "$LILYJS_DIR/src/music-rendering/fonts/TeXGyreSchola-BoldItalic.woff2" \
   "$GIUSTO_DIR/public/lilyjs/fonts/"

echo "Synced lilyJS ${LILYJS_TAG:-$LILYJS_COMMIT}."
echo "packages/lilyjs/index.d.ts is hand-maintained — update it if the API surface you use changed."
