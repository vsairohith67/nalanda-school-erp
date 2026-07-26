# PWA Physical Device Staging Checklist

Status: planning only. Certification must not begin until an approved, trusted-certificate HTTPS staging origin exists. A localhost/self-signed proxy rehearsal is not certification.

DEVOPS-1D payment/provider work is currently deferred, so this checklist remains blocked and must not be treated as evidence that Android/iPhone certification is safe to begin.

## Entry gates

- HTTPS certificate/redirect/HSTS/secure-cookie/proxy/cache tests passed on `staging.nalandaps.com` or the approved staging name.
- Synthetic-only environment, named accounts, device owner consent, screenshot policy, access logs and incident contact are active.
- Manifest/icons/service worker are the release under test; private pages/APIs are no-store and absent from Cache Storage.
- No live messaging/payment/AI/OCR/cloud provider; no real contacts/documents/camera content.

## Android (current Chrome on at least one supported school device)

- Confirm install prompt/criteria or documented manual install, correct app name/icons/maskable icon/theme/splash.
- Launch standalone from home screen; verify HTTPS origin, no browser chrome, responsive login, session persistence policy and protected route isolation.
- Login/logout/change user; logout clears the Secure session and Nalanda PWA caches; back button does not reveal private content.
- Release update: detect new worker/version, explain refresh, activate intentionally, remove old Nalanda caches, retain no private response.
- Offline: navigation shows the approved offline shell and explicitly says records are unavailable; login, APIs, pages, JSON/PDF/CSV/images/documents are not served from cache.
- Inspect Cache Storage/service-worker network behavior; only manifest/icons/hashed static assets/offline shell exist.
- Test file chooser/camera only on a generated synthetic image and only if a separately approved workflow requires it; current Permissions-Policy disables camera APIs.
- Revoke access/logout, clear site data, uninstall, verify icon/cache removal and test-account expiry.

## iPhone (current supported iOS/Safari)

- Use Safari Share > Add to Home Screen; record iOS version and known absence/differences of install prompts.
- Verify home-screen icon, standalone launch, safe-area/responsive layout, login/logout and session invalidation.
- Test service-worker update behavior after closing/reopening; document Safari caching/version limitations instead of claiming parity with Android.
- Offline shell only; inspect Web Inspector where available and prove no private navigation/API/document cache.
- Test file chooser/camera with generated synthetic content only if separately approved; document iOS permission and PWA background limitations.
- Remove from Home Screen, clear Safari website data, revoke test account and prove no retained private/synthetic record outside policy.

## Evidence

For each device record model, OS/browser, viewport CSS pixels, release, manifest/SW version, timestamp, pass/fail, safe screenshot references, console/network/cache findings and cleanup. Never record device identifiers, personal Apple/Google account details, notifications/contacts/photos, or real school data.
