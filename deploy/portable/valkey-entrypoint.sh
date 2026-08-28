#!/bin/sh
set -eu
umask 077
password="$(cat /run/secrets/valkey_password)"
{
  printf 'bind 0.0.0.0\n'
  printf 'protected-mode yes\n'
  printf 'port 6379\n'
  printf 'save ""\n'
  printf 'appendonly no\n'
  printf 'maxmemory 384mb\n'
  printf 'maxmemory-policy allkeys-lru\n'
  printf 'timeout 60\n'
  printf 'requirepass %s\n' "$password"
} >/tmp/valkey.conf
unset password
exec valkey-server /tmp/valkey.conf
