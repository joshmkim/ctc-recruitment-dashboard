#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# .env.local is intentionally not committed. An exported value wins, which lets
# CI provide the connection string without creating a local file.
if [[ -z "${SUPABASE_DB_URL:-}" && -f "$root/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$root/.env.local"
  set +a
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  cat >&2 <<'EOF'
SUPABASE_DB_URL is required.
Copy the connection string from Supabase Dashboard → Connect → Direct connection,
then add it to .env.local:

SUPABASE_DB_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
EOF
  exit 1
fi

command -v psql >/dev/null || {
  echo "psql is required. Install PostgreSQL client tools and try again." >&2
  exit 1
}

psql "$SUPABASE_DB_URL" --set=ON_ERROR_STOP=1 -q -c \
  "create table if not exists public.ctc_schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  );"

tracked_count="$(psql "$SUPABASE_DB_URL" -tAc "select count(*) from public.ctc_schema_migrations")"
if [[ "$tracked_count" == "0" ]]; then
  existing_schema="$(psql "$SUPABASE_DB_URL" -tAc \
    "select to_regclass('public.applicants') is not null")"
  baseline="${MIGRATION_BASELINE:-}"

  if [[ "$existing_schema" == "t" && -z "$baseline" ]]; then
    cat >&2 <<'EOF'
This database already has application tables but no migration history.
To avoid re-running old migrations, state the latest migration already applied:

MIGRATION_BASELINE=13 npm run migrate

For a new empty database, use:

MIGRATION_BASELINE=0 npm run migrate
EOF
    exit 1
  fi

  if [[ -n "$baseline" && ! "$baseline" =~ ^[0-9]+$ ]]; then
    echo "MIGRATION_BASELINE must be a numeric migration version, such as 13." >&2
    exit 1
  fi

  if [[ -n "$baseline" && "$baseline" -gt 0 ]]; then
    for migration in "$root"/supabase/migrations/*.sql; do
      filename="$(basename "$migration")"
      version="${filename%%_*}"
      if (( 10#$version <= baseline )); then
        psql "$SUPABASE_DB_URL" --set=ON_ERROR_STOP=1 -q -c \
          "insert into public.ctc_schema_migrations (filename) values ('$filename') on conflict do nothing;"
      fi
    done
  fi
fi

for migration in "$root"/supabase/migrations/*.sql; do
  filename="$(basename "$migration")"
  applied="$(psql "$SUPABASE_DB_URL" -tAc \
    "select 1 from public.ctc_schema_migrations where filename = '$filename'")"

  if [[ "$applied" == "1" ]]; then
    echo "Skipping $filename (already applied)"
    continue
  fi

  echo "Applying $filename"
  # A failed migration rolls back completely, and is not recorded as applied.
  psql "$SUPABASE_DB_URL" --set=ON_ERROR_STOP=1 --single-transaction -f "$migration"
  psql "$SUPABASE_DB_URL" --set=ON_ERROR_STOP=1 -q -c \
    "insert into public.ctc_schema_migrations (filename) values ('$filename');"
done

echo "Migrations are up to date."
