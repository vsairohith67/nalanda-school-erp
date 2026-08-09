# Public login-support anti-enumeration specification

The public form accepts minimum identity-as-supplied data, one preferred contact, a limited category, bounded plain text, unchecked consent and at most one normalised still screenshot. Its response is always: “Your support request has been received. Keep the reference shown on this page.”

Existing, nonexistent, disabled and mismatched identifiers receive equivalent public behavior. Source and identifier evidence is HMAC-hashed; raw network data is not retained. Honeypot, duplicate fingerprint and rate thresholds may neutralise a submission while preserving the generic response. No public reset, activation, password, security answer, token, account role, Student or Staff lookup exists.
