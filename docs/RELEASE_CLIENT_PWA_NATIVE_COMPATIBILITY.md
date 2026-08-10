# Web/PWA and Future Native Client Compatibility

The Web/PWA is the V1 client. `/api/release/client-version` returns only release ID, client build ID, minimum supported client, update severity/date and maintenance state with `no-store`. It exposes no commit, path, database, migration or internal hash.

Client states are `CURRENT`, `UPDATE_AVAILABLE`, `UPDATE_RECOMMENDED`, `UPDATE_REQUIRED`, `INCOMPATIBLE` and `UNKNOWN`. Updates remain explicit. The client checks for dirty forms and declared upload/payment/marks/import/release/Safe Exit activity, offers **Update after saving**, and stores only a privacy-safe local deferral key. Even critical incompatibility does not blindly reload over unsafe work.

The service worker uses build-ID cache names, deletes only obsolete Nalanda static caches, never caches API/authenticated HTML/PDF/CSV/private documents, and uses a privacy-safe offline shell. Logout/account switch cleanup remains explicit. Localhost-origin confusion and stale-shell regression are covered by the release tests and Browser QA.

Future Android phone/tablet and iPhone/iPad clients use compatibility contract `nalanda-client-v1`, capability negotiation, minimum-supported version, a release-note/update URL where approved, and a critical-update response. Authentication, permission, ownership and idempotency remain server-side. Deprecation requires at least one normal transition window unless an approved integrity/security event requires a shorter window. App-store approval is asynchronous; server policy must tolerate review delay.
