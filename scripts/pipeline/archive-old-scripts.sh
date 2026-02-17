#!/bin/bash
#
# archive-old-scripts.sh — Move old one-off scripts to _archive/
#
# Keeps: pipeline/, utils/, package.json, tsconfig.json, node_modules
# Archives: everything else in scripts/
#
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"
ARCHIVE_DIR="$SCRIPTS_DIR/_archive"

mkdir -p "$ARCHIVE_DIR"

# Files/dirs to keep in scripts/
KEEP=(
  "pipeline"
  "utils"
  "_archive"
  "node_modules"
  "package.json"
  "package-lock.json"
  "tsconfig.json"
  "data-audit.ts"
  "security-audit.ts"
)

# Build a find exclusion pattern
EXCLUDE_ARGS=()
for item in "${KEEP[@]}"; do
  EXCLUDE_ARGS+=(-not -name "$item" -not -path "*/$item/*" -not -path "*/$item")
done

echo ""
echo "================================================================"
echo "  ARCHIVE OLD SCRIPTS"
echo "================================================================"
echo ""

count=0

for f in "$SCRIPTS_DIR"/*.ts "$SCRIPTS_DIR"/*.sh "$SCRIPTS_DIR"/*.log; do
  [ -f "$f" ] || continue
  basename=$(basename "$f")

  # Check if it's in the keep list
  skip=false
  for keep in "${KEEP[@]}"; do
    if [ "$basename" = "$keep" ]; then
      skip=true
      break
    fi
  done

  # Keep data-audit and security-audit
  if [[ "$basename" == "data-audit.ts" ]] || [[ "$basename" == "security-audit.ts" ]]; then
    skip=true
  fi

  if [ "$skip" = true ]; then
    continue
  fi

  mv "$f" "$ARCHIVE_DIR/"
  count=$((count + 1))
done

# Move scrapers/ directory too if it exists
if [ -d "$SCRIPTS_DIR/scrapers" ]; then
  mv "$SCRIPTS_DIR/scrapers" "$ARCHIVE_DIR/"
  echo "  Moved scrapers/ directory"
fi

# Move sql/ directory
if [ -d "$SCRIPTS_DIR/sql" ]; then
  mv "$SCRIPTS_DIR/sql" "$ARCHIVE_DIR/"
  echo "  Moved sql/ directory"
fi

echo "  Archived $count files to scripts/_archive/"
echo ""
echo "  Remaining in scripts/:"
ls -1 "$SCRIPTS_DIR" | grep -v _archive | head -20
echo ""
echo "  Done."
