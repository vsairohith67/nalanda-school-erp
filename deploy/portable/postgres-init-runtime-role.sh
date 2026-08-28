#!/bin/sh
set -eu
runtime_password="$(cat /run/secrets/postgres_runtime_password)"
migrator_password="$(cat /run/secrets/postgres_migrator_password)"
backup_password="$(cat /run/secrets/postgres_backup_password)"
maintenance_password="$(cat /run/secrets/postgres_backup_maintenance_password)"
psql --set=ON_ERROR_STOP=1 --set=runtime_password="$runtime_password" --set=migrator_password="$migrator_password" --set=backup_password="$backup_password" --set=maintenance_password="$maintenance_password" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE nalanda_migrator LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS', :'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nalanda_migrator') \gexec
SELECT format('CREATE ROLE nalanda_runtime LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nalanda_runtime') \gexec
SELECT format('CREATE ROLE nalanda_backup LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS', :'backup_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nalanda_backup') \gexec
SELECT format('CREATE ROLE nalanda_backup_maintenance LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS', :'maintenance_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nalanda_backup_maintenance') \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT, TEMPORARY, CREATE ON DATABASE nalanda_portable_synthetic TO nalanda_migrator;
GRANT USAGE, CREATE ON SCHEMA public TO nalanda_migrator;
GRANT CONNECT ON DATABASE nalanda_portable_synthetic TO nalanda_runtime;
GRANT USAGE ON SCHEMA public TO nalanda_runtime;
GRANT CONNECT ON DATABASE nalanda_portable_synthetic TO nalanda_backup;
GRANT USAGE ON SCHEMA public TO nalanda_backup;
GRANT CONNECT ON DATABASE nalanda_portable_synthetic TO nalanda_backup_maintenance;
GRANT USAGE ON SCHEMA public TO nalanda_backup_maintenance;
SQL
unset runtime_password migrator_password backup_password maintenance_password
