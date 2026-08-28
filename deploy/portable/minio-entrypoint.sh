#!/bin/sh
set -eu
export MINIO_ROOT_USER="$(cat /run/secrets/minio_root_access_key)"
export MINIO_ROOT_PASSWORD="$(cat /run/secrets/minio_root_secret_key)"
export MINIO_KMS_SECRET_KEY="$(cat /run/secrets/minio_kms_secret_key)"
export MINIO_BROWSER=off
exec minio "$@"
