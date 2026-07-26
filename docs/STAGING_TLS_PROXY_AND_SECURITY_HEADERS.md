# Staging TLS, Proxy, Cache, and Security Headers

This plan preserves SEC-1 controls and adds no public endpoint except a content-free liveness route.

## TLS and HSTS

- Only HTTPS is externally reachable. Port 80 performs a 308 redirect to the exact HTTPS host; it never proxies application traffic.
- TLS 1.2+ with modern ciphers; automated certificate renewal at managed ingress or Caddy. The Node server listens on `127.0.0.1` only.
- `ENABLE_HSTS=true` yields `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Verify the staging certificate/redirect first. Do not request preload and do not alter the apex/Google Workspace records in DEVOPS-1C.
- `SESSION_COOKIE_SECURE=true` produces a Secure, HttpOnly, Path=/, SameSite=strict `__Host-nalanda_session` cookie with no Domain attribute.

## Trusted proxy contract

Trust requires all three conditions: the app port is loopback/private and firewall-blocked, the single ingress overwrites (not appends untrusted values to) `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Forwarded-For`/`X-Real-IP`, and both `TRUST_PROXY_HEADERS=true` plus `NALANDA_TRUSTED_PROXY_MODE=single-hop-sanitized` pass validation. If any condition is absent, forwarded headers are ignored and the rate limiter uses `direct`.

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

The reviewed Caddy template implements mutually exclusive request-body handlers and requires Caddy 2.10 or newer. The only 26 MiB exception is `POST /api/fee-register-ocr/batches/<one-segment-id>/pages`; every other request remains at 5 MiB. Validate with the exact installed Caddy binary before DNS activation.

## Cache rules

- Authenticated pages, redirects, APIs, provider webhooks, auth, health and private exports: `Cache-Control: private, no-store` (health may also use `no-store`). Never CDN-cache them.
- Public website navigation HTML: validate/revalidate only; do not mix authenticated responses in a cache key. Staging itself should not be indexed.
- `/_next/static` content-hashed assets: `public, max-age=31536000, immutable` as set by Next.js.
- PWA manifest/icons: bounded public revalidation. `/sw.js`: no-cache/no-store/must-revalidate.
- The service worker caches approved static assets/offline shell only and rejects navigation, APIs, login, redirects, private/no-store, Set-Cookie, HTML, JSON, PDF, CSV and binary responses.

## Rate limits and brute force

The in-process login limiter blocks a trusted client source/account combination after 10 failures in 5 minutes for 60 seconds. It is single-instance and resets on restart. Add ingress limits for connection rate, login POSTs, setup, upload routes, AI/worker triggers, and webhooks; use conservative bursts and 429/Retry-After without reflecting identifiers. Alert on distributed/repeated failures. Do not use a single untrusted `direct` bucket that lets one caller deny all logins.

## Local/automated evidence

Focused tests cover secure cookies, proxy-mode dual opt-in, origin handling, request sizes, CSP, private cache and deployment health. The local rehearsal must prove HTTPS proxy redirect/forwarding behavior, HSTS, protected-page redirect/API denial, no-store headers and safe static caching. A self-signed local certificate proves proxy mechanics only; it is not physical PWA certification. Raw Caddy access logging remains disabled until a separately approved configuration proves route-template normalization, query-string removal and header redaction.
