#!/bin/sh
# Import sqltables/*.sql into PostgreSQL (keeps existing rows).
# Run inside Coolify app container: sh scripts/coolify-db-import.sh
set -e

if [ ! -d "./sqltables" ]; then
  echo "sqltables/ folder not found in /app"
  exit 1
fi

export NODE_PATH="/prisma-tools/node_modules:${NODE_PATH:-}"
exec node scripts/import-sqltables.mjs
