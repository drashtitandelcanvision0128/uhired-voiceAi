#!/bin/sh
set -e

# Prisma migrate needs session mode (pooler :5432) or direct db host.
# Many hosts (Coolify/Docker) cannot reach db.<ref>.supabase.co — keep pooler :5432.
prepare_supabase_migrate_url() {
  url="$1"
  case "$url" in
    *pooler.supabase.com:6543*)
      echo "[entrypoint] Using Supabase session pooler (:5432) for migrations."
      printf '%s' "$url" \
        | sed 's|pooler\.supabase\.com:6543|pooler.supabase.com:5432|g' \
        | sed 's|[?&]pgbouncer=true||g' \
        | sed 's|?&|?|g' \
        | sed 's|?$||g'
      ;;
    *)
      printf '%s' "$url"
      ;;
  esac
}

# Dual-repo / multi-replica safety: only one service should migrate.
# Set RUN_MIGRATIONS=false on API replicas or the frontend when the backend owns migrations.
should_run_migrations=true
case "${RUN_MIGRATIONS:-true}" in
  0|false|FALSE|no|NO|off|OFF) should_run_migrations=false ;;
esac

if [ -n "$DATABASE_URL" ] && [ "$should_run_migrations" = "true" ]; then
  if [ -n "$DIRECT_URL" ]; then
    migrate_url=$(prepare_supabase_migrate_url "$DIRECT_URL")
    if [ "$migrate_url" != "$DIRECT_URL" ]; then
      export DIRECT_URL="$migrate_url"
    fi
  else
    export DIRECT_URL=$(prepare_supabase_migrate_url "$DATABASE_URL")
    echo "[entrypoint] Set DIRECT_URL for migrations from DATABASE_URL."
  fi

  PRISMA=/prisma-tools/node_modules/.bin/prisma

  # One-time recovery: removed migration failed mid-deploy and blocks new ones (P3009).
  echo "[entrypoint] Clearing failed migration record (if any)..."
  "$PRISMA" migrate resolve \
    --rolled-back 20260615_requirement_invite_expiry \
    --schema=./prisma/schema.prisma || true

  echo "[entrypoint] Applying pending Prisma migrations..."
  "$PRISMA" migrate deploy --schema=./prisma/schema.prisma
  echo "[entrypoint] Migrations complete."
elif [ "$should_run_migrations" = "false" ]; then
  echo "[entrypoint] RUN_MIGRATIONS=false — skipping migrations (another service owns them)."
else
  echo "[entrypoint] DATABASE_URL is not set — skipping migrations."
fi

echo "[entrypoint] Starting application..."
exec node server.js
