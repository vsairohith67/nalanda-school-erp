# Unified Communication Delivery Architecture

Status: `COMMUNICATION-DELIVERY-FOUNDATION-1A` software foundation. The committed parent and five channel flags are OFF at 0%. No live provider, real recipient, or real message is authorised.

## Flow

1. An authorised server-side domain workflow records its business result and returns a bounded authority receipt tying the exact source record/event, recipient policy, and maximum audience to that result.
2. It emits a typed `CommunicationIntent`; browser clients cannot supply message text or a destination.
3. A versioned server-owned recipient policy resolves an audience and records its deterministic digest.
4. The service renders an immutable template version for a channel and locale, applies consent/preferences, and creates one idempotent outbox item per recipient/channel.
5. External workers claim bounded items with database lease tokens. In-app items become owned inbox records without a provider call.
6. A server-selected adapter validates the request. In 1A only `DISABLED` and the network-incapable `LOCAL_SYNTHETIC_SINK` exist.
7. Signed webhooks are limited to 64 KiB and a dedicated abuse budget, scope event keys and message lookup to the exact provider profile/channel, append receipts only after a compare-and-set transition, and advance state monotonically. Operations surfaces expose only safe aggregates.

Business success, queue creation, provider acceptance, send, and delivery are separate states. A communication failure never rolls back a valid Payment, attendance event, report, Parent Meeting, Support case, Safe Exit record, identity event, Offline Sync result, or biometric reconciliation.

## Durable concepts

The additive SQLite/PostgreSQL models cover governed contact points, template definitions and versions, preferences, consent, provider non-secret metadata, intents, outbox items, attempts, receipts, webhook replay evidence, synthetic native-push endpoints, and privacy-safe audit events. Existing Prompt 19A/19B/19C and domain outboxes remain readable and restorable. They are compatibility sources during staged consolidation; historical rows are not rewritten.

## Trust boundaries

- The ERP owns recipient identity, linked-child scope, active Staff/Guardian state, contact selection, consent, purpose, authorisation, template, and delivery state.
- Destinations are resolved again immediately before dispatch. A changed digest suppresses the item.
- External content is generic and links to an independently authorised application page. No private attachment or OCR content is eligible.
- Provider credentials and webhook secrets are environment/secret-store concerns and are absent from the database, backup, repository, logs, UI, and metrics.
- External dispatch requires the current verified contact-point ID/version and, where policy requires it, consent captured for that exact contact version.
- Restore maps user/Guardian/Staff ownership into the target identity space, skips unresolved owners, normalises in-flight rows to non-sending manual review, and never updates append-only attempts, receipts, or audit evidence. Both database providers enforce evidence immutability with no-update/no-delete triggers.
- Universal Search and Smart AI do not index or mutate communication data.

## Portability

SQLite is the default operational provider. PostgreSQL 17 has a separate additive migration with the same models, relations, unique constraints, and indexes. Database claiming uses compare-and-set state plus an owner token and expiring lease rather than a process-local mutex. Valkey remains the established distributed abuse-control boundary; no competing cache or rate-limit service was introduced.

## Activation boundary

Software clearance does not select a provider or authorise DNS verification, sender registration, billing, credentials, private staging, real data/users/devices, notification permissions, deployment, or a live message. Those actions require the generated 1B/1C prompts.
