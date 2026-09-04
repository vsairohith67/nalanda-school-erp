# Webhook and Delivery-Receipt Foundation

The webhook route selects a configured adapter server-side. It accepts only an exact profile code, a known non-in-app channel, and the local synthetic adapter in 1A. The parent and selected child channel flags must pass before processing. Shared middleware rejects declared or streamed bodies above 64 KiB and applies a dedicated per-actor webhook rate policy before route allocation.

Every request requires `application/json`, a body no larger than 64 KiB, a timestamp within five minutes, and an HMAC signature over the exact timestamp plus raw body. The adapter verifies the signature in constant time. The handler bounds a request to 100 events and never logs the secret, body, destination, message, or provider response.

The stored event key is a SHA-256 scope of provider profile plus provider event key. A duplicate increments only a safe replay counter. Message lookup also requires the exact profile and channel. Unknown message IDs are recorded as ignored. A valid matched receipt is appended only after a state-and-version compare-and-set succeeds, then monotonic precedence applies: delivered cannot become sent; policy-terminal/cancelled/expired/dead-letter items cannot become delivered; late, concurrent, or contradictory events are preserved as ignored evidence.

This fixture is not proof of any commercial provider’s official signature format. A future certification must implement and test the selected provider’s exact official verification, IP/network boundary where appropriate, key rotation, replay semantics and outage recovery.
