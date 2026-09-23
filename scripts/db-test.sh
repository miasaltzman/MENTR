#!/usr/bin/env bash
# Apply every migration to a fresh scratch database and run the SQL test suite.
# Requires a local Postgres 15+ (psql on PATH). Configure with DB_TEST_URL
# (a superuser connection to an admin database), default: local postgres user.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_URL="${DB_TEST_URL:-postgresql:///postgres}"
DB_NAME="mentr_test_$$"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

run_as() {
  if [[ -z "${DB_TEST_URL:-}" && "$(id -un)" == "root" ]]; then
    su postgres -c "$(printf '%q ' "$@")"
  else
    "$@"
  fi
}

db_url() {
  if [[ -n "${DB_TEST_URL:-}" ]]; then
    echo "${DB_TEST_URL%/*}/$DB_NAME"
  else
    echo "postgresql:///$DB_NAME"
  fi
}

cleanup() { run_as "${PSQL[@]}" "$ADMIN_URL" -c "drop database if exists $DB_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

run_as "${PSQL[@]}" "$ADMIN_URL" -c "create database $DB_NAME"
URL="$(db_url)"

apply() {
  echo "  → $(basename "$1")"
  run_as "${PSQL[@]}" "$URL" -f "$1"
}

echo "Supabase stub"
apply "$ROOT/tests/db/00_supabase_stub.sql"

echo "Migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do apply "$f"; done

if [[ -n "${DB_TYPES_OUT:-}" ]]; then
  echo "Generating types → $DB_TYPES_OUT"
  run_as "${PSQL[@]}" "$URL" -f "$ROOT/scripts/introspect.sql" | npx --no-install tsx "$ROOT/scripts/gen-db-types.ts" "$DB_TYPES_OUT"
fi

echo "Tests"
for f in "$ROOT"/tests/db/[1-9]*.sql; do apply "$f"; done

if [[ "${DB_TEST_KEEP:-}" == "1" ]]; then
  trap - EXIT
  echo "Kept database: $URL"
fi

echo "✓ Database tests passed"
