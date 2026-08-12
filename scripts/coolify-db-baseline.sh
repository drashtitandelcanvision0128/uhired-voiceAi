#!/bin/sh
# Mark all Prisma migrations as applied (fixes P3005 on DB that already has tables).
# Run inside Coolify app container: sh scripts/coolify-db-baseline.sh
set -e

PRISMA="${PRISMA_BIN:-/prisma-tools/node_modules/.bin/prisma}"
SCHEMA="./prisma/schema.prisma"

echo "Baselining migrations with $PRISMA ..."

for dir in prisma/migrations/*/; do
  [ -d "$dir" ] || continue
  name=$(basename "$dir")
  printf "  %s... " "$name"
  if "$PRISMA" migrate resolve --applied "$name" --schema="$SCHEMA" >/dev/null 2>&1; then
    echo "ok"
  else
    echo "already applied or skipped"
  fi
done

echo "Done."
