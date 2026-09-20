#!/usr/bin/env bash
set -euo pipefail

database_url="${ADMIN_DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/wepush}"
web_password="${WEB_DB_PASSWORD:-wepush_web}"
worker_password="${WORKER_DB_PASSWORD:-wepush_worker}"
admin_password="${ADMIN_DB_PASSWORD:-wepush_admin}"

psql "$database_url" \
  -v ON_ERROR_STOP=1 \
  -v web_password="$web_password" \
  -v worker_password="$worker_password" \
  -v admin_password="$admin_password" \
  --file=db/runtime/001_login_roles.sql
