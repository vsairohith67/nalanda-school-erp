#!/bin/sh
set -eu

root_access="$(cat /run/secrets/minio_root_access_key)"
root_secret="$(cat /run/secrets/minio_root_secret_key)"
app_access="$(cat /run/secrets/s3_access_key_id)"
app_secret="$(cat /run/secrets/s3_secret_access_key)"
backup_access="$(cat /run/secrets/s3_backup_access_key_id)"
backup_secret="$(cat /run/secrets/s3_backup_secret_access_key)"
maintenance_access="$(cat /run/secrets/s3_backup_maintenance_access_key_id)"
maintenance_secret="$(cat /run/secrets/s3_backup_maintenance_secret_access_key)"

mc alias set nalanda http://object-store:9000 "$root_access" "$root_secret"
mc mb --ignore-existing nalanda/nalanda-portable-synthetic-private
mc version enable nalanda/nalanda-portable-synthetic-private
mc anonymous set none nalanda/nalanda-portable-synthetic-private
mc admin user add nalanda "$app_access" "$app_secret"
mc admin policy create nalanda nalanda-portable-app /opt/nalanda/minio-app-policy.json
mc admin policy attach nalanda nalanda-portable-app --user "$app_access"
mc admin user add nalanda "$backup_access" "$backup_secret"
mc admin policy create nalanda nalanda-portable-backup /opt/nalanda/minio-backup-policy.json
mc admin policy attach nalanda nalanda-portable-backup --user "$backup_access"
mc admin user add nalanda "$maintenance_access" "$maintenance_secret"
mc admin policy create nalanda nalanda-portable-backup-maintenance /opt/nalanda/minio-backup-maintenance-policy.json
mc admin policy attach nalanda nalanda-portable-backup-maintenance --user "$maintenance_access"
