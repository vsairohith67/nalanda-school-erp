# Durable Outbox, Idempotency, and Retry

Outbox states are `DRAFT`, `PENDING_APPROVAL`, `QUEUED`, `SCHEDULED`, `CLAIMED`, `SENDING`, `ACCEPTED_BY_PROVIDER`, `SENT`, `DELIVERED`, `FAILED_RETRYABLE`, `FAILED_PERMANENT`, `SUPPRESSED`, `CANCELLED`, `EXPIRED`, and `DEAD_LETTER`. The typed transition table rejects delivery downgrades and any attempt to turn a policy-terminal suppression into sent/delivered.

Each item binds intent, subject, channel, template version, recipient/contact version, deduplication key, idempotency key, substitutions and deterministic render hash. The intent key is unique; reuse with altered logical content is rejected. The recipient/channel tuple is unique. Before a send, an existing accepted/sent/delivered attempt short-circuits provider execution.

Workers use a database compare-and-set claim, random owner token, claim time, and one-minute expiry. `CLAIMED` and `SENDING` leases can be recovered after expiry. Two replicas can race, but only one update owns the item. Providers must use the stable idempotency key because a crash after an external acceptance can never be made perfectly exactly-once by a network client.

Retries use bounded attempts, exponential backoff, deterministic jitter, provider retry-after, expiry, and permanent-error classification. Invalid destination/consent/policy failures do not retry. Exhaustion becomes visible `DEAD_LETTER`; it never silently requeues on restore. Cancellation is allowed only before provider acceptance and records actor, reason, time, and affected count.

Provider profiles carry `CLOSED`, `OPEN`, and `HALF_OPEN` circuit state. Repeated retryable failures open a circuit for a bounded recovery interval; an accepted probe closes it. Security, safety, transactional, normal, and optional ordering prevents optional bulk work from starving critical work without bypassing consent.
