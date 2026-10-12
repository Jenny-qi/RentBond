#!/bin/sh
set -eu
# Separate application owner; the web/Workers never connect as cluster superuser.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 --set=app_password="$RENTBOND_APP_DB_PASSWORD" <<'SQL'
CREATE ROLE rentbond LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';
ALTER DATABASE rentbond OWNER TO rentbond;
GRANT USAGE, CREATE ON SCHEMA public TO rentbond;
SQL
