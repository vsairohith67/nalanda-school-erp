# Origin Hiding and Edge Security Blueprint

Status: provider-neutral design template; not activated.

```text
Internet
  -> managed DDoS / WAF / CDN edge
  -> authenticated tunnel or edge-restricted private origin
  -> reverse proxy
  -> loopback/private ERP application
  -> private database and private storage
```

## Mandatory topology

- The VPS origin has no public direct application listener. Prefer an authenticated outbound tunnel. If an edge-to-origin listener is unavoidable, the host firewall accepts only current edge ranges and a separately managed administration network.
- The reverse proxy overwrites every forwarding and edge identity header. It adds the secret `X-Nalanda-Proxy-Auth` proof from a secret store, never from a client value.
- The application enables `authenticated-edge-v1`, requires trusted proxy proof, selects one exact client-IP header, and rejects boundary mismatches. Direct requests may reach only content-free health checks.
- SSH is key-only, root login and passwords are disabled, and source access is restricted to the administration network or a separately authenticated management tunnel.
- Database and private object storage are never internet exposed. The ERP application identity receives only required access.
- Admin routes receive an additional edge access-control policy; application authorization remains mandatory and is never replaced by an edge rule.
- TLS is end-to-end. Edge-to-origin authentication uses a tunnel identity or origin certificate. Rotate origin certificates and the proxy proof independently, with overlap and rollback procedures.
- Backup egress is allowlisted to the approved private destination. No real backup is sent during rehearsal, and restore occurs only to isolated infrastructure.
- Public DNS contains only edge/tunnel endpoints. Remove legacy A/AAAA records, mail or auxiliary records that reveal the origin, old certificate transparency names, screenshots, headers, and repository examples that disclose it.

## Firewall and listener acceptance

Before private staging, prove from an external administration-controlled probe that the direct application port, database, storage, metrics, debugger, and SSH are unreachable outside their approved networks. On-host inspection must prove the Node listener is loopback/private only and that the firewall default is deny. Edge health checks use a content-free endpoint.

## Trusted proxy rotation

1. Generate a high-entropy proof in the secret manager.
2. Configure the reverse proxy to strip client `Forwarded`, `X-Forwarded-*`, `X-Real-IP`, `CF-Connecting-IP`, and `X-Nalanda-Proxy-Auth` values.
3. Add canonical protocol/host/client IP plus the proof.
4. Configure the same proof in the application environment and validate 403 on missing, wrong, duplicated, comma-separated, IPv4-variant, and IPv6-variant identity.
5. Rotate with a short dual-secret window implemented at the secret/tunnel layer, then remove the previous proof. The current application contract accepts one proof only, so a restart/reload boundary must be coordinated.

## Origin exposure response

If an origin is discovered, enter under-attack mode, restrict the firewall/tunnel, preserve evidence, rotate the origin address/certificate/proxy proof where required, remove revealing DNS/history sources, validate edge-only reachability, and follow `ORIGIN_EXPOSURE_RUNBOOK.md`. Do not merely hide the navigation or change DNS while leaving the origin reachable.
