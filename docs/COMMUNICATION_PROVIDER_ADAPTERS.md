# Provider-Neutral Adapter Contract

The adapter contract exposes configuration validation, privacy-safe health, send, webhook verification, receipt normalisation, error classification, synthetic cost estimation, and close. It receives only the rendered request and no unrestricted database access.

| Adapter | 1A state | Network capability |
| --- | --- | --- |
| `DISABLED` | Default for every channel | None; returns a precise provider-disabled failure. |
| `LOCAL_SYNTHETIC_SINK` | Isolated copied/synthetic QA only | Hard-coded `false`; accepts `.invalid` email or `synthetic:sms`, `synthetic:whatsapp`, and `synthetic:push` identifiers only. |
| Email provider | Contract boundary only | Disabled; no SMTP/API SDK or domain verification. |
| SMS provider | Contract boundary only | Disabled; no sender registration/DLT/provider. |
| Meta WhatsApp Cloud | Existing 19B disabled boundary retained | Live mode additionally requires unified parent/child flags; no API call. |
| FCM/APNs | Native-push boundary only | Disabled; no token registration, permission request, key, certificate, or call. |

The local sink deterministically derives a provider message ID from channel, idempotency key and render hash; captures one immutable payload; and simulates accepted, delivered, timeout before/after acceptance, 429, outage, invalid destination, hard bounce and complaint. It never calls the network and raw captured archives are not committed.

Provider profiles contain non-secret adapter/channel/environment/sender/region/template/rate/cost/circuit metadata. API keys, access tokens, SMTP passwords, webhook secrets, signing material, FCM service accounts and APNs keys must remain in the existing provider-neutral secret boundary. Arbitrary endpoints and provider selection are not accepted from a client or stored in these models.
