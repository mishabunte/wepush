#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_root"

reset_data=false
open_browser=true

usage() {
  cat <<'EOF'
Usage: ./demo.sh [--reset] [--no-open] [--help]

Starts the complete Docker demo, opens the creator UI, and runs the workload.

  --reset    Destructively restore the small development dataset first.
  --no-open  Do not open a system browser (useful for CI and smoke tests).
  --help     Show this help text.

The workload runs for one hour by default. Override it with LOAD_* variables,
for example LOAD_DURATION_SECONDS, LOAD_CREATORS, LOAD_CAMPAIGNS, and LOAD_BIDS.
EOF
}

while (($# > 0)); do
  case "$1" in
    --reset)
      reset_data=true
      ;;
    --no-open)
      open_browser=false
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose=(docker-compose)
else
  echo "Docker Compose is required (docker compose or docker-compose)." >&2
  exit 1
fi

for command_name in psql curl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name is required to run the demo." >&2
    exit 1
  fi
done

db_port="${DB_PORT:-5433}"
api_port="${API_PORT:-3000}"
frontend_port="${FRONTEND_PORT:-8080}"
database_url="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:${db_port}/wepush}"
admin_database_url="${ADMIN_DATABASE_URL:-$database_url}"
creator_url="http://127.0.0.1:${frontend_port}"
admin_url="${creator_url}/admin"

show_failure_context() {
  echo "Demo startup failed. Current service state:" >&2
  "${compose[@]}" ps >&2 || true
  "${compose[@]}" logs --tail 80 api worker frontend >&2 || true
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempts="${3:-60}"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl --fail --silent --show-error --max-time 3 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "$name did not become ready at $url." >&2
  return 1
}

echo "Starting PostgreSQL..."
"${compose[@]}" up -d db
for ((attempt = 1; attempt <= 30; attempt += 1)); do
  if "${compose[@]}" exec -T db pg_isready -U postgres -d wepush >/dev/null 2>&1; then
    break
  fi
  if ((attempt == 30)); then
    echo "PostgreSQL did not become ready." >&2
    "${compose[@]}" ps >&2 || true
    exit 1
  fi
  sleep 2
done

echo "Applying migrations and provisioning runtime roles..."
DATABASE_URL="$database_url" ./scripts/db-setup.sh
ADMIN_DATABASE_URL="$admin_database_url" ./scripts/db-provision-runtime.sh

has_marketplace_data="$(
  psql "$database_url" -At -v ON_ERROR_STOP=1 -c \
    'SELECT EXISTS (
       SELECT 1 FROM marketplace.creators
       UNION ALL SELECT 1 FROM marketplace.campaigns
       UNION ALL SELECT 1 FROM marketplace.bids
     )'
)"

if [[ "$reset_data" == true ]]; then
  echo "Resetting marketplace data to the development seed..."
  DATABASE_URL="$database_url" ./scripts/db-seed.sh
elif [[ "$has_marketplace_data" == "f" ]]; then
  echo "The marketplace is empty; loading the development seed..."
  DATABASE_URL="$database_url" ./scripts/db-seed.sh
else
  echo "Existing marketplace data found; preserving it. Use --reset to reseed."
fi

echo "Building and starting the API, worker, and frontend..."
"${compose[@]}" up -d --build api worker frontend

if ! wait_for_url "API" "http://127.0.0.1:${api_port}/readyz" 60; then
  show_failure_context
  exit 1
fi
if ! wait_for_url "Frontend" "${creator_url}/nginx-health" 60; then
  show_failure_context
  exit 1
fi

echo "Creator UI: $creator_url"
echo "Admin UI:   $admin_url"

if [[ "$open_browser" == true ]]; then
  if command -v open >/dev/null 2>&1; then
    open "$creator_url" >/dev/null 2>&1 || echo "Could not open the browser; use $creator_url" >&2
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$creator_url" >/dev/null 2>&1 || echo "Could not open the browser; use $creator_url" >&2
  else
    echo "No supported browser opener found; use $creator_url" >&2
  fi
fi

load_environment=(-e "LOAD_BASE_URL=${LOAD_BASE_URL:-http://frontend:8080}")
for variable_name in \
  LOAD_DURATION_MINUTES LOAD_DURATION_SECONDS LOAD_CREATORS LOAD_CAMPAIGNS \
  LOAD_BIDS LOAD_SEED LOAD_RETRIES; do
  if [[ -n "${!variable_name+x}" ]]; then
    load_environment+=(-e "${variable_name}=${!variable_name}")
  fi
done

echo "Starting the demo workload (one hour by default; press Ctrl-C to stop)..."
"${compose[@]}" exec -T "${load_environment[@]}" api node dist/load-test.js
