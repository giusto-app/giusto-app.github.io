#!/usr/bin/env bash
set -euo pipefail

GIUSTO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LILYJS_SOURCE="${LILYJS_DIR:-$GIUSTO_DIR/../lilyJS}"

if [ ! -f "$LILYJS_SOURCE/package.json" ]; then
  echo "lilyJS repository not found at $LILYJS_SOURCE (set LILYJS_DIR to override)" >&2
  exit 1
fi

LILYJS_TAG="${1:-$(git -C "$LILYJS_SOURCE" tag --list 'v[0-9]*' --sort=-version:refname | sed -n '1p')}"
if [ -z "$LILYJS_TAG" ]; then
  echo "No versioned lilyJS tag found in $LILYJS_SOURCE" >&2
  exit 1
fi
if ! git -C "$LILYJS_SOURCE" rev-parse --verify --quiet "refs/tags/$LILYJS_TAG" >/dev/null; then
  echo "lilyJS tag not found: $LILYJS_TAG" >&2
  exit 1
fi

TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/giusto-lilyjs-sync.XXXXXX")"
cleanup() { rm -rf "$TEMP_DIR"; }
trap cleanup EXIT

echo "Checking out lilyJS $LILYJS_TAG from $LILYJS_SOURCE ..."
git -c advice.detachedHead=false clone --quiet --local --no-hardlinks \
  --branch "$LILYJS_TAG" "$LILYJS_SOURCE" "$TEMP_DIR/lilyJS"

echo "Installing the released lilyJS dependencies ..."
(cd "$TEMP_DIR/lilyJS" && bun install --frozen-lockfile)

LILYJS_DIR="$TEMP_DIR/lilyJS" LILYJS_TAG="$LILYJS_TAG" \
  bash "$GIUSTO_DIR/scripts/sync-lilyjs.sh"

echo "Review and commit the synchronized Giusto files before pushing."
