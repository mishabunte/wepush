#!/usr/bin/env bash
set -euo pipefail

database_url="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/wepush}"

psql "$database_url" -v ON_ERROR_STOP=1 --file=db/tests/001_database.sql
psql "$database_url" -v ON_ERROR_STOP=1 --file=db/tests/003_admin.sql
DATABASE_URL="$database_url" db/tests/002_concurrent_closure.sh
