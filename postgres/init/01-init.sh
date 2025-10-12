#!/usr/bin/env bash
set -euo pipefail

# You can override these via .env / compose env
LITELLM_DB="${LITELLM_DB:-litellm_db}"
LITELLM_DB_USER="${LITELLM_DB_USER:-litellm}"
LITELLM_DB_PASSWORD="${LITELLM_DB_PASSWORD:-litellm_db}"

APP_DB="${APP_DB:-flownova_app_db}"
APP_DB_USER="${APP_DB_USER:-flownova}"
APP_DB_PASSWORD="${APP_DB_PASSWORD:-flownova_app_db}"

echo "==> Creating roles (if missing)…"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${LITELLM_DB_USER}') THEN
      CREATE ROLE ${LITELLM_DB_USER} LOGIN PASSWORD '${LITELLM_DB_PASSWORD}';
   END IF;
   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_DB_USER}') THEN
      CREATE ROLE ${APP_DB_USER} LOGIN PASSWORD '${APP_DB_PASSWORD}';
   END IF;
END
\$\$;
SQL

db_exists () {
  psql -tAc "SELECT 1 FROM pg_database WHERE datname='$1'" --username "$POSTGRES_USER" --dbname postgres | grep -q 1
}

echo "==> Creating databases (if missing)…"
if ! db_exists "$LITELLM_DB"; then
  psql --username "$POSTGRES_USER" --dbname postgres -c "CREATE DATABASE ${LITELLM_DB} OWNER ${LITELLM_DB_USER};"
fi
if ! db_exists "$APP_DB"; then
  psql --username "$POSTGRES_USER" --dbname postgres -c "CREATE DATABASE ${APP_DB} OWNER ${APP_DB_USER};"
fi

echo "==> Granting privileges…"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
GRANT ALL PRIVILEGES ON DATABASE ${LITELLM_DB} TO ${LITELLM_DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${APP_DB}    TO ${APP_DB_USER};
SQL

echo "==> Done."
