#!/usr/bin/env bash
set -euo pipefail

database_url="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/wepush}"

psql "$database_url" -v ON_ERROR_STOP=1 --file=db/seeds/001_development.sql
