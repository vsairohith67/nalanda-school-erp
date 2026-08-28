#!/bin/sh
set -eu
export PROXY_SHARED_SECRET="$(cat /run/secrets/proxy_shared_secret)"
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
