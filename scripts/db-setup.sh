#!/usr/bin/env bash
set -euo pipefail

database_url="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/wepush}"

psql "$database_url" -v ON_ERROR_STOP=1 -c \
  "CREATE TABLE IF NOT EXISTS public.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT statement_timestamp())"

for migration in db/migrations/*.sql; do
  version="$(basename "$migration")"

  if [[ ! "$version" =~ ^[0-9A-Za-z_.-]+$ ]]; then
    echo "Invalid migration filename: $version" >&2
    exit 1
  fi

  applied="$(psql "$database_url" -At -v ON_ERROR_STOP=1 -c \
    "SELECT EXISTS (SELECT 1 FROM public.schema_migrations WHERE version = '$version')")"

  if [[ "$applied" == "f" ]]; then
    psql "$database_url" -v ON_ERROR_STOP=1 \
      --single-transaction \
      --file="$migration" \
      --command="INSERT INTO public.schema_migrations(version) VALUES ('$version')"
  fi
done
