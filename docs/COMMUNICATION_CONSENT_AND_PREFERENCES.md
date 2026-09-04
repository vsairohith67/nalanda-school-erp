# Communication Consent and Preferences

Consent is scoped to identity/person, channel, purpose, evidence source, capture/expiry/revocation times, evidence reference, contact version, and status. Supported states are `NOT_REQUIRED_BY_APPROVED_POLICY`, `NOT_CAPTURED`, `PENDING`, `GRANTED`, `REVOKED`, `EXPIRED`, `CONTACT_CHANGED_RECONFIRMATION_REQUIRED`, and `DISPUTED`.

A non-empty contact field is not consent and is not automatically verified. A new contact version invalidates stale consent eligibility. Hard bounce, complaint, opt-out, changed, revoked, and expired contact states affect only that communication channel; they do not deactivate the account.

The preferences centre is own-account only and exposes masked contact state, optional category/channel enablement, preferred channel, `en-IN`/`te-IN`/`hi-IN`, quiet hours, timezone, and digest frequency. It cannot modify another user, turn on a provider, disable a required security/safety notice, or turn marketing into a mandatory purpose.

External opt-out must be purpose/channel-specific, non-enumerating, time-bounded, audited, and based on a hashed or cryptographically protected token. 1A records the consent boundary but does not activate a public provider unsubscribe endpoint.
