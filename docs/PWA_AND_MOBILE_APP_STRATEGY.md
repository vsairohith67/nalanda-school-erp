# Privacy-Safe PWA Foundation and Mobile App Strategy

## Status and scope

Prompt 19D adds an installable Progressive Web App foundation to the existing Next.js App Router ERP. It does not create a native application, app-store package, offline school database, background write queue, push-notification system, device registry, or install analytics.

The server remains authoritative. Authentication, role permissions, Parent/Teacher isolation, validation, business workflows, audit trails, and backup/restore continue to run on the server.

Documentation review date: **2026-07-18**

Project framework and deployment baseline:

- installed Next.js version: **15.5.19**
- `package.json` declared range: `^15.3.4`
- router: Next.js App Router
- database: SQLite through Prisma
- current baseline: trusted local Windows deployment
- future domain assumption: an HTTPS origin such as `erp.nalandaps.com` or `app.nalandaps.com` may be evaluated, but this phase does not claim a production application hostname, certificate, reverse proxy, or cloud host

## Official documentation reviewed

The implementation was checked against current official sources rather than remembered PWA behavior:

- Next.js, [Progressive Web Apps guide](https://nextjs.org/docs/app/guides/progressive-web-apps): App Router manifest convention, service-worker registration, HTTPS, and response-header guidance.
- MDN, [Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable): required manifest members, 192px/512px icons, HTTPS/localhost requirements, browser differences, and `beforeinstallprompt` limitations.
- MDN, [Web application manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest): manifest linking and `application/manifest+json`.
- MDN, [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) and [Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers): secure contexts, scope, lifecycle, waiting workers, fetch handling, and cache cleanup.
- W3C, [Service Workers specification](https://www.w3.org/TR/service-workers/): lifecycle, fetch interception, messaging, and `updateViaCache`.
- MDN, [CacheStorage.delete](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage/delete) and [Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache): named-cache lifecycle, matching, versioning, and deletion.
- MDN, [`ServiceWorkerRegistration.update()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update): explicit checks and byte-different worker installation.
- web.dev, [What does it take to be installable?](https://web.dev/articles/install-criteria) and [Installation prompt](https://web.dev/learn/pwa/installation-prompt): current Chromium promotion/engagement behavior and deferred prompting.
- Apple Support, [Turn a website into an app in Safari on iPhone](https://support.apple.com/en-ph/guide/iphone/iphea86e5236/ios): Add to Home Screen/Open as Web App steps.

### Browser assumptions and partial support

- Production service workers require HTTPS. Supporting browsers treat `localhost` and `127.0.0.1` as secure local-development contexts.
- Chromium may expose `beforeinstallprompt`; availability also depends on browser engagement, install state, policy, and device conditions.
- iPhone/iPad installation is a manual browser/share-menu flow. Programmatic install cannot be claimed on iOS.
- Firefox desktop does not provide the same manifest-driven installation experience as Chromium.
- Standalone display is only a browser/OS hint from `display-mode: standalone` or the legacy iOS standalone property; it is not a device identity.
- An embedded QA browser may support manifests and service workers without exposing native installation UI.
- Browser QA is not physical-device certification. Android/iOS home-screen icons, masking, OS task switching, uninstall, and app-store behavior require real-device testing.
- No app-store, government, production-domain, or physical-device certification is implied.

## Existing application audit

### Assets and visual decisions

- Reused source: `public/nalanda-logo.jpg`, 1080×1080.
- The existing favicon reference is preserved.
- Generated first-party PNGs:
  - `public/icons/icon-192.png`
  - `public/icons/icon-512.png`
  - `public/icons/icon-maskable-192.png`
  - `public/icons/icon-maskable-512.png`
  - `public/icons/apple-touch-icon.png` at 180×180
- Regular icons preserve the square logo proportions.
- Maskable icons reduce the logo to 72% of a white square canvas so important artwork remains in a conservative safe area.
- No external image, school record, screenshot, privileged shortcut, share target, file handler, or protocol handler is included.
- Light theme colour: `#0f766e`; dark browser theme colour: `#172438`; manifest background: `#f4f7f8`.

### Authentication, shell and storage

- Existing session authentication is HTTP-only-cookie based and remains server-authoritative.
- `/install-app` calls `requireUser()` and is available to authenticated roles.
- `/settings/pwa` calls `requirePermission("VIEW_SYSTEM_HEALTH")`. Current recommended defaults grant this to Super Admin, Director, and Admin; Parent and Teacher remain blocked.
- `/offline`, `/manifest.webmanifest`, `/sw.js`, the logo, and icons are public because they contain no school records.
- The global shell hosts connection and controlled-update UX.
- Parent/Teacher navigation and the authenticated account menu link to Install App.
- Existing theme and operational local-storage entries are preserved.
- PWA code stores only a non-sensitive install-guidance dismissal timestamp.
- No IndexedDB, session token, cookie, password, user identity, route history, form data, or school record is stored by the PWA.

### Security and deployment audit

- Prior code had no manifest, service worker, registration, PWA cache, or offline page.
- Middleware marks authenticated non-static responses `private, no-store`.
- Global headers add `nosniff`, frame denial, same-origin referrer policy, and a no-device-capability Permissions Policy.
- The application CSP was not weakened. A new global strict CSP is deferred until the Next.js framework-script nonce/hash strategy is reviewed.
- `/sw.js` has same-origin CSP, JavaScript MIME type, `nosniff`, root scope allowance, no-referrer, and `no-cache, no-store, must-revalidate`.
- Manifest and icon responses use bounded public revalidation.
- Registration runs only in production, preventing development workers/caches from becoming stale.

## Manifest behavior

`app/manifest.ts` uses the App Router convention and declares the Nalanda name/description, `/` start and scope, standalone display, any orientation, `en-IN`/LTR, education/productivity categories, and exact 192px/512px normal/maskable PNG icons.

It intentionally omits privileged shortcuts, screenshots, Student routes, share targets, file/protocol handlers, and external resources.

## Service-worker architecture

### Versioning and updates

- Build input: `NEXT_PUBLIC_PWA_BUILD_VERSION`
- Fallback: package version
- Normalisation: letters, numbers, dot, underscore, and hyphen
- Cache prefix: `nalanda-pwa-`
- Static cache: `nalanda-pwa-static-<build-version>`
- A byte-different `/sw.js` installs a new waiting worker.
- Install never calls `skipWaiting()`.
- Update Now opens an accessible confirmation.
- Confirm Update Now sends `SKIP_WAITING`.
- `controllerchange` reloads once only when that page initiated the confirmed update.
- Later leaves the current version active.
- Activation claims clients and removes old caches only when their names start with `nalanda-pwa-`.

Allowed worker messages:

- `SKIP_WAITING`
- `CLEAR_NALANDA_PWA_CACHES`
- `GET_PWA_VERSION`

Unknown messages are ignored.

### Precache

Install attempts to cache only the generic `/offline` page, manifest, public logo, and five generated icons. These requests omit credentials. Errors, redirects, private responses, and responses with `Set-Cookie` are rejected.

### Runtime cache allowlist

`isSafePwaStaticRequest`/`isSafePwaStaticResponse` and equivalent worker checks require:

- same origin and GET
- non-navigation
- no query string or fragment
- exact public allowlist or `/_next/static/**`
- successful HTTP 200 without redirect
- no `private`, `no-store`, or `Set-Cookie`
- no HTML, JSON, PDF, CSV, or generic binary download, except the exact manifest media type

Strategies:

- immutable `/_next/static/**`: cache-first
- public logo/icons/manifest: stale-while-revalidate
- navigation: network-only; network failure returns only `/offline`
- APIs, non-GET, and unknown requests: network-only

Explicit exclusions include authenticated HTML, `/api/**`, `/login`, all Parent/Teacher/Student/Staff/finance/marks/report-card/certificate/ID-card/Library/communication data, `/_next/image`, cross-origin assets, redirects, errors, CSV/PDF/print/export/backup/download payloads, Blob/signed URLs, and user-query cache keys.

Prompt 20C does not weaken this boundary. `/cloud-backup/**`, `/api/cloud-backup/**`, `.npsbackup` objects, verification responses, reports/CSV, and any future artifact download are network-only/private and must never enter Cache Storage, IndexedDB, or a Browser bundle. Encryption keys remain server-environment only.

## Offline behavior

`/offline` contains only the ERP name, “You are offline,” “Reconnect to continue securely,” “School records are not stored for offline use,” a connection hint, Retry Connection, and Return to Login. It includes no school settings, names, record history, last-viewed data, form content, or private navigation state. Essential text and links remain usable without JavaScript.

Failed authenticated navigation never looks up the requested page in CacheStorage; it returns the one cached offline response. API and write failures remain normal network failures.

The global banner says viewing/saving school records requires a connection. Reconnection shows a brief confirmation. It does not reload, resubmit, replay, or claim a write was queued.

## Install experience

`/install-app` detects standalone display, captures `beforeinstallprompt` when available, requires a user click, stores only a dismissal timestamp, listens for `appinstalled`, does not claim success from prompt acceptance alone, and provides manual iOS/Android/desktop guidance.

It explains that login remains required, records are not downloaded, server records survive uninstall, and no certification is implied. There is no first-load modal, notification/device prompt, or install analytics.

## Update experience

When a worker waits:

1. an accessible banner announces it;
2. Later keeps the current worker;
3. Update Now opens an accessible dialog;
4. confirmation sends `SKIP_WAITING`;
5. `controllerchange` reloads once;
6. activation removes only old Nalanda caches.

The app never silently activates/reloads while form work may be unsaved.

## Logout and manual cache clearing

Logout performs the server-authoritative POST and best-effort removal of `nalanda-pwa-*` caches. Cache failure cannot preserve authentication because the server clears the session cookie. The worker is not unregistered and receives no logout token.

**Clear Offline App Assets** uses an accessible confirmation and removes only Nalanda PWA caches. It does not delete server records, passwords, unrelated caches/site data, theme preference, or cookies.

## PWA diagnostics

`/settings/pwa` shows support/registration/controller/scope, build version, active/waiting state, standalone/online hints, Nalanda cache names and entry counts, manifest/icon fetch status, secure-context status, install-event exposure, a generic redacted error, and the policy summary.

Actions are Check for Update, Clear Offline App Assets, and Re-register Service Worker. Re-registration uses the fixed `/sw.js` path and never unregisters or bypasses waiting-update safety.

Cookies, tokens, headers, cached bodies, passwords, IP/device identity, location, and subscription data are not shown.

## Explicitly absent capabilities

There is no push/notification-click handler, permission request, PushManager/VAPID/Firebase configuration, background/periodic sync, offline POST replay, mutation queue, sensitive IndexedDB/local storage, device tracking/fingerprinting, advertising ID, location/camera/microphone/Bluetooth/NFC/biometric/serial access, or native/app-store package.

## Mobile strategy decision matrix

| Option | Strengths | Costs and risks | Decision |
| --- | --- | --- | --- |
| Responsive Web ERP | Existing one-codebase baseline; browser access; no install; lowest complexity | Browser chrome; users retain URL/bookmark | Keep as baseline |
| Installable PWA | One codebase; icon/standalone launch; immediate web releases; server-authoritative; no sensitive offline DB or store dependency | Browser differences; HTTPS and physical-device QA required; no offline school workflow | **Recommended now** |
| App-store Web Wrapper | Future Capacitor-style wrapper or Android TWA may add store distribution | Signing/store policy, privacy disclosure, deep links, secure storage, version coordination, permission review, review delays, support burden; no automatic offline-safety gain | Evaluate only after stable cloud deployment and real demand |
| Fully Native App | Appropriate only for proven deep device integration, complex offline-first needs, or native performance | Separate codebase/framework, API versioning, security review, release engineering, store maintenance, device/accessibility/performance matrix | Defer until evidence shows PWA cannot meet an essential need |

## Recommended path and future gates

1. Continue the responsive ERP.
2. Keep this PWA static-assets-only.
3. Complete production Browser QA and a supervised Parent/Teacher physical-device pilot.
4. Consider a wrapper only after stable HTTPS cloud deployment and actual demand.
5. Consider native only for proven requirements the PWA cannot safely meet.

Future gates: stable HTTPS/domain/certificate, external encrypted backup/restore exercise, privacy policy, terms, retention/deletion policy, support ownership, incident response, app-store accounts, reproducible signed builds, deep-link/API version design, secure-storage review, separately authorised push privacy design, device-permission register, physical-device QA, performance/accessibility testing, and store disclosures/review time.

## Schema, backup, and prompt boundary

No Prisma model or migration is needed. There are no device, install, analytics, offline-operation, or subscription records. Backup format remains **version 33**.

Prompt 19D-QA is complete. Prompt 20A now adds a separate server-only read-only AI retrieval foundation; it does not change service-worker caching, offline behavior, installability, push, or device permissions. AI questions, answers, evidence, pages, and APIs remain network-only and are never cached by the PWA. Backup format is now **version 34** because Prompt 20A adds six privacy-safe AI control/audit/evaluation models.

## Prompt 21A Student-location boundary

Prompt 21A adds planning documents only; current backup is version 37 and no PWA code changes. A future Student address/location page and API remain authenticated network-only with `Cache-Control: private, no-store`. They must never enter the service-worker allowlist/runtime cache, Cache Storage, IndexedDB, localStorage, install metadata, notifications, background sync, offline queue, shared URL, or analytics.

No phase may request browser/device geolocation merely because the ERP is installable. Map tiles, provider responses, address searches, points, and viewports are sensitive network data and require a separately approved Prompt 21C/21D CSP, provider, privacy, and physical-device review. Static-only caching remains the default.
