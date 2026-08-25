# Native authentication bridge

The native flow is first-party, browser-mediated, device-bound, and feature-gated.

1. The app creates a PKCE verifier/challenge, state, nonce, and Ed25519 device key.
2. It opens the exact ERP authorization URL in the system browser.
3. The existing browser session identifies the user; the server requires explicit consent and validates role, permissions, version policy, device status, and both release flags.
4. The server returns a one-time code only for an active approved device.
5. The exact `nalandaps-erp://auth/callback` deep link returns the code.
6. The app registers a live listener and checks the platform's current deep link after unlock, so a callback received during background auto-lock or cold start is not discarded. A processed callback is removed from Stronghold and cannot be exchanged twice.
7. Exchange requires the verifier, exact callback, and signed device proof.

Authorization codes expire after 90 seconds and are single-use. Access tokens are opaque, hashed server-side, device-bound, and expire after 10 minutes. Refresh tokens rotate on every use, have a 7-day sliding and 30-day absolute lifetime, require a fresh signed proof nonce, and are stored only as hashes on the server. Reuse commits revocation of the whole token family before returning the error.

The app stores the refresh token only in a PIN-protected Stronghold vault. ERP passwords, browser cookies, client secrets, static API keys, and device private keys are never exported into web state or SQLite.

Server routes are limited to `/api/native-auth/request`, `/authorize`, `/exchange`, `/refresh`, and `/logout`; native data routes are `/api/native/v1/context`, `/reference-pack`, `/sync`, and `/conflicts`.
