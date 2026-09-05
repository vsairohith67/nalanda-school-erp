# Observability decision record

Status: proposed future architecture from exact released source; **no telemetry package installed or provider configured in this phase**. Session replay remains OFF. This decision does not replace the existing school-facing Technical Operations workspace.

## Existing system

`lib/technical-operations.ts`, `technical-operations-types.ts`, `technical-operations-api.ts`, the `/technical-operations` surfaces, their migrations/backup mappings, `tests/technical-operations.test.ts` and `docs/OBSERVABILITY_OPERATIONS_ARCHITECTURE.md` provide thirteen operational domains, role-controlled detail, aggregate health, alerts, incidents, maintenance, provider-disabled states, job health and recovery runbooks. Keep this as the authoritative school-facing monitoring and incident workspace.

`lib/portable-runtime/observability.ts` already emits bounded structured logs and an allowlisted counter vocabulary, with protected internal metrics. It is not OpenTelemetry. Its field-name allowlist still accepts strings in fields such as `safeCode`, `routeCategory`, `requestId` and `jobId`; names alone do not prove value privacy. `safeRequestFingerprint` is a truncated unsalted hash, not proof of anonymisation. Export adapters must not forward this output blindly. The next phase must introduce strict values and provenance before any exporter can be enabled.

## Evaluated choices

| Component | Decision and reason | Boundary |
| --- | --- | --- |
| Internal Technical Operations | Retain school-facing health, incident ownership and maintenance authority | Optional provider failure is separate from core application health |
| OpenTelemetry traces, metrics and logs | Future common instrument/event contract, independent of backend | Start with schema-validated no-network synthetic sinks; uncontrolled auto-instrumentation is excluded |
| OpenTelemetry Collector | Optional local receiver/processor/export boundary | Least-privilege endpoints, resource/queue caps, allowlisting before export and authenticated private transport |
| Prometheus | Optional self-hosted metrics storage/querying | Bounded low-cardinality labels and private scrape endpoint |
| Grafana | Optional operator dashboards over approved signals | No public dashboard or school-record drill-down; school staff continue to use Technical Operations |
| Loki | Optional self-hosted log backend | Accept only approved structured events, not raw process/access logs |
| Tempo | Optional self-hosted trace backend | Random operation correlation only; no request payloads, record IDs, SQL parameters or raw URLs |
| Sentry | Optional default-off error/performance adapter | No required startup/runtime dependency; explicit approved fields, replay disabled, no default raw breadcrumbs/body/header capture |
| PostHog | Optional default-off product analytics/feature-flag/survey adapter | No autocapture, session replay, identity profiles or school survey responses; existing release flags remain authoritative |

The Collector has security/redaction mechanisms, but those mechanisms do not make arbitrary input safe: [OpenTelemetry sensitive-data guidance](https://opentelemetry.io/docs/security/handling-sensitive-data/) and [Collector configuration guidance](https://opentelemetry.io/docs/security/config-best-practices/), reviewed 2026-09-05. Metrics/log/trace backend roles follow the official [Prometheus overview](https://prometheus.io/docs/introduction/overview/), [Loki documentation](https://grafana.com/docs/loki/latest/) and [Tempo documentation](https://grafana.com/docs/tempo/latest/). PostHog supports recording controls; this design requires capture to stay disabled at the application boundary, rather than relying on sample rates or remote rules: [recording controls](https://posthog.com/docs/session-replay/how-to-control-which-sessions-you-record). Sentry's detailed data-collected page could not be fetched by this audit tool; exact SDK defaults and sanitisation hooks must be verified against the pinned SDK before later adapter implementation. No commercial availability or compliance claim is made.

## Strict event allowlist

Future contract `telemetryEvent.v1` permits only: schema version; server timestamp rounded to a minute; enumerated service/environment/profile; verified release commit; enumerated route template from a server registry; enumerated operation; HTTP status class; duration bucket; enumerated dependency state; enumerated safe error code; bounded numeric count; and fresh random trace/span IDs that are never derived from an account, device, Student, Parent, Staff or financial record. Additional properties are rejected, never passed through. No arbitrary error message, stack local variable, breadcrumb label or request-supplied safe code is allowed.

Example synthetic event:

```json
{"schemaVersion":1,"service":"erp","environment":"synthetic","operation":"readiness","routeTemplate":"/api/health/ready","statusClass":"2xx","durationBucket":"under_100ms","dependencyState":"healthy","safeCode":"READY","count":1}
```

Prohibited everywhere, including logs/metric labels/resource attributes/baggage: request/response bodies, cookies, authentication headers, passwords, OTPs, tokens, names, phones, Email addresses, Student/Parent/Staff identifiers, Aadhaar, financial references/ledger descriptions, certificate content, support/complaint/disciplinary narratives, OCR images/text, paths containing private identifiers, raw search queries, raw URLs or URLs with record keys. Unknown fields or values are rejected. Redaction is defence in depth after minimisation; it is not permission to capture private input first.

URL normalisation resolves an internal route-template identifier before telemetry construction. Strip query, fragment, credentials, host-specific private names and dynamic segments; unmatched routes become `UNKNOWN_ROUTE`. Never infer a safe route by replacing only numeric IDs. Forbid UUID, slug, admission number and encoded-key leaks. No person-level pseudonym is required. A hashed low-entropy identifier remains sensitive and is prohibited; rotating operational trace IDs must not become a cross-session tracking key.

## Operating controls for the future foundation

- **Modes:** `PROVIDER_DISABLED` is the default and performs zero network calls or exporter initialization. `LOCAL_ONLY` uses a bounded in-memory sink or separately admitted private Collector. Any external mode needs a new privacy/provider/owner gate. The app starts and runs fully without Sentry/PostHog packages or endpoints being configured.
- **Failure isolation:** enqueue only after school transactions settle; bounded queue, no synchronous network wait in request/finance/attendance/issuance paths. Drop excess telemetry, increment an aggregate safe counter and expose telemetry degradation separately. Export timeouts, retries and circuit breaking must be bounded. Never retry school transactions because telemetry failed.
- **Role access:** exact technical permission for detailed infrastructure signals; leadership aggregate summary only; no Teacher/Parent/public access. Export permission is separate. Access is audited internally without logging private contents.
- **Proposed defaults for synthetic evaluation:** traces sampled at 0% in provider-disabled mode; 1% only in a separately enabled local test; errors capped at 10 safe events/minute/replica; queue at 1,000 events or 1 MiB; event size at 2 KiB; flush timeout at 1 second and at most two background attempts. These are testable design defaults, not measured production guarantees.
- **Proposed retention/storage limits:** local traces 24 hours, safe logs 7 days, aggregate metrics 30 days; 256 MiB diagnostic allocation on small profiles with rotation and drop-on-full. Durable audit/legal evidence remains in its authoritative ERP store under separate policy. Owner must approve any operational retention change.
- **Proposed alerts:** readiness fails for three consecutive probes; HTTP 5xx above 2% for 5 minutes with at least 100 requests; backup verification overdue beyond approved schedule plus grace; disk above 85% warning/95% critical; queue saturation or exporter loss reports telemetry degradation. Low-volume cases must not produce misleading percentages. Tune against later synthetic load and approved operational targets.
- **Cost:** estimate from event rate × approved sampling × mean serialized bytes × retention, plus compute/egress/backup. Keep inputs configurable, label estimates and require current official pricing and owner approval before spend.

Required negative tests: nested private values; mixed-case/encoded keys; Unicode/control characters; error messages containing synthetic identities; query/path/URL leakage; raw SQL/baggage/headers; low-entropy hash pseudonyms; high-cardinality labels; unknown fields/enums; replay/autocapture toggles; exporter timeout, DNS failure, queue saturation, credential failure and provider-disabled zero-network behavior. Compare core transaction results with provider absent, disabled and failed.
