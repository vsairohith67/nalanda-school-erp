# Job and Outbox Runbook

1. Separate queued, retrying, failed, dead-letter, and attention-required counts by owning module.
2. Inspect only safe error fingerprints and aggregate status; never recipient, document, message, or provider payload data.
3. Confirm idempotency and retry policy before any governed retry.
4. Do not activate a provider or bypass consent/cost gates.
5. Escalate repeated failure as an incident and verify recovery clears the deduplicated alert.
