# Staging TLS, Proxy, Cache, and Security Headers

This plan preserves SEC-1 controls and adds no public endpoint except a content-free liveness route.

## TLS and HSTS

- Only HTTPS is externally reachable. Port 80 performs a 308 redirect to the exact HTTPS host; it never proxies application traffic.
- TLS 1.2+ with modern ciphers; automated certificate renewal at managed ingress or Caddy. The Node server listens on `127.0.0.1` only.
- `ENABLE_HSTS=true` yields `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Verify the staging certificate/redirect first. Do not request preload and do not alter the apex/Google Workspace records in DEVOPS-1C.
- `SESSION_COOKIE_SECURE=true` produces a Secure, HttpOnly, Path=/, SameSite=strict `__Host-nalanda_session` cookie with no Domain attribute.

## Trusted proxy contract

Trust requires all conditions: the app port is loopback/private and firewall-blocked; the ingress overwrites forwarding/client identity headers; it adds a secret-store `X-Nalanda-Proxy-Auth` proof; canonical host/protocol match `APP_ORIGIN`; and `TRUST_PROXY_HEADERS=true`, `NALANDA_TRUSTED_PROXY_MODE=authenticated-edge-v1`, `NALANDA_REQUIRE_TRUSTED_PROXY=true`, one approved `NALANDA_CLIENT_IP_HEADER`, and a high-entropy `NALANDA_PROXY_SHARED_SECRET` pass validation. If proof is missing or invalid, forwarded headers are ignored; production-shaped origin requests fail closed except content-free health.

Reject multiple/invalid hosts, unexpected schemes, CR/LF, oversized header blocks, and direct app-port traffic at the proxy. Preserve the original client IP only in the sanitized single-hop field. Do not trust arbitrary RFC 7239 `Forwarded` input.

## Request and response controls

| Control | Current app | Staging ingress requirement |
| --- | --- | --- |
| General body limit | 5 MiB, including streamed bodies | 5 MiB or lower; return 413 |
| OCR upload | 26 MiB for exact page-upload route | 26 MiB only on exact path; other routes remain 5 MiB |
| Server Action | 4 MiB | proxy no larger than app route contract |
| Slow clients/timeouts | Node app does not replace proxy protection | header/read/write/idle timeouts; connection/request-rate limits |
| CORS/origin | unsafe methods require configured same origin; provider webhook exception only | do not add wildcard CORS; strip unsolicited CORS headers |
| CSP | nonce + strict-dynamic, self-only resources, no objects/frames, optional HTTPS upgrade | preserve header; do not loosen for provider widgets |
| Frame protection | `frame-ancestors 'none'` and `X-Frame-Options: DENY` | preserve both |
| Referrer | `same-origin` globally; SW uses no-referrer | preserve or tighten only after QA |
| Permissions | camera/mic/geolocation/Bluetooth/USB/serial denied | preserve. Device file chooser/camera requires a separately scoped future decision. |
| MIME/COOP/CORP | nosniff, same-origin opener/resource policies | preserve |

## Cache rules

- Authenticated pages, redirects, APIs, provider webhooks, auth, health and private exports: `Cache-Control: private, no-store` (health may also use `no-store`). Never CDN-cache them.
- Public website navigation HTML: validate/revalidate only; do not mix authenticated responses in a cache key. Staging itself should not be indexed.
- `/_next/static` content-hashed assets: `public, max-age=31536000, immutable` as set by Next.js.
- PWA manifest/icons: bounded public revalidation. `/sw.js`: no-cache/no-store/must-revalidate.
- The service worker caches approved static assets/offline shell only and rejects navigation, APIs, login, redirects, private/no-store, Set-Cookie, HTML, JSON, PDF, CSV and binary responses.

## Rate limits and brute force

The central typed policy and specialised login limiter provide development/test controls, but their memory adapters are single-process and reset on restart. Staging/production require `SECURITY_RATE_LIMIT_MODE=distributed` plus a registered atomic distributed adapter, and fail with controlled 503 on governed endpoints when it is absent. Add corresponding ingress limits for connection rate and each named endpoint family; use conservative bursts and 429/Retry-After without reflecting identifiers. Alert on distributed/repeated failures. Do not claim the in-memory adapter protects multiple instances.

## Local/automated evidence

Focused tests cover secure cookies, proxy-mode dual opt-in, origin handling, request sizes, CSP, private cache and deployment health. The local rehearsal must prove HTTPS proxy redirect/forwarding behavior, HSTS, protected-page redirect/API denial, no-store headers and safe static caching. A self-signed local certificate proves proxy mechanics only; it is not physical PWA certification.
