# WhatsApp Business One-Way Communication Workflow

## Scope and non-goals

Prompt 19B supports one-way Guardian and Staff messages through Meta's official WhatsApp Business Platform Cloud API only. It does not use WhatsApp Web, a personal account, browser automation, unofficial clients, groups, free-form business-initiated messages, media, OTP/authentication, Student/minor direct delivery, chatbot behavior, automated replies, agent handoff, or a two-way inbox. Prompt 19C email/SMS and Prompt 19D push/PWA remain separate.

The default provider is `MOCK`; live sending is disabled. Credentials are environment-only. Access tokens, app secrets, webhook verification tokens, authorization headers, full sending numbers, and full destination numbers are absent from WhatsApp-specific database rows, reports, CSV, logs, and UI.

## Official Meta review

Reviewed 17 July 2026:

- WhatsApp Business Platform/Cloud API overview and changelog.
- Graph API changelog: current Graph API `v25.0`, introduced 18 February 2026.
- Template fundamentals/status rules, updated 21 May 2026.
- Webhook verification/signature guidance, updated 17 June 2026.
- Message send and message-status payload documentation.
- WhatsApp pricing guidance and official INR rate card effective 1 July 2026.

Provider sends use `POST /v25.0/{Phone-Number-ID}/messages` when `WHATSAPP_GRAPH_API_VERSION=v25.0`. The version is configurable and must be reviewed before LIVE deployment.

Only locally `ACTIVE` mappings with provider status `APPROVED` are sendable. Prompt 19B records Meta's approved `UTILITY` or `MARKETING` category; it does not guess. Provider `PENDING`, `REJECTED`, `PAUSED`, `DISABLED`, or unknown status blocks sends.

Webhook GET verification uses `hub.mode=subscribe`, `hub.verify_token`, and `hub.challenge`. POST reads the raw body and validates `X-Hub-Signature-256` as HMAC-SHA256 using a timing-safe comparison. Invalid signatures are rejected. Statuses are deduplicated and monotonic: `SENT → DELIVERED → READ`; `READ` cannot regress and implies delivery. Unknown message IDs become redacted ignored events.

Official references:

- `https://developers.facebook.com/documentation/business-messaging/whatsapp/overview`
- `https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-fundamentals`
- `https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview`
- `https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing`
- `https://developers.facebook.com/docs/graph-api/changelog`

## Contact identity and consent

Authoritative sources are `Guardian.primaryMobile` and `StaffMember.mobile`. Parent ownership is `User.guardianId → Guardian`; Staff ownership is `StaffMember.userId → User`.

Send format is strict E.164. Approved visual separators are removed. Extensions, unsupported characters, implausible lengths, and invalid Indian mobile prefixes are rejected. A country code is never silently invented. A configurable default such as `+91` is used only after explicit preview/confirmation. Source contacts are never rewritten.

Delivery records store a SHA-256/HMAC phone hash, last four digits, and operational country code. The full number is derived again from the authoritative record at send time and exists only in memory for the provider call. Consent is bound to the exact hash. A changed phone invalidates old consent and requires fresh opt-in.

Consent is explicit and never preselected. Existing contact data is not consent. Imported consent requires evidence. Opt-out is immediate, append-only, and cancels scheduled/queued/retry/sending rows without deleting history. Parent and Teacher APIs enforce their own Guardian/linked StaffMember server-side.

The compliance webhook recognizes only exact `STOP`, `UNSUBSCRIBE`, and `OPT OUT`. Other inbound messages are not stored as conversations, and no automatic reply is sent.

## Templates and Prompt 19A reuse

A batch references a published Prompt 19A `NotificationCampaign` and immutable recipient snapshot; the original campaign is never edited. Resolution maps only `NotificationRecipient` users to an owned Guardian or StaffMember. It skips missing/invalid phones, missing/expired/opted-out/changed-phone consent, unmapped users, and ambiguous duplicate phones.

Multi-child recipients become one contact with generic linked-children context. Allowed variables are `school_name`, `campaign_title`, `campaign_category`, `recipient_label`, and `child_context`. Student names, admission numbers, marks, balances, health data, certificates, raw IDs, arbitrary JSON, contact fields, and media are rejected. Rendered parameters are snapshotted.

## Batch, queue, retry, and status

Normal flow:

`DRAFT → PREVIEWED → READY_FOR_APPROVAL → APPROVED → QUEUED/PROCESSING → COMPLETED or PARTIALLY_FAILED`

Preview writes zero delivery rows. The creator cannot approve their batch. Final queueing revalidates campaign, profile, mapping, consent, source phone, quiet hours, and permission, then creates delivery rows transactionally with a unique logical key and request fingerprint.

The database worker does not need an open browser. It conditionally claims bounded chunks, recovers stale `SENDING` claims, revalidates phone/consent, enforces hourly/daily limits, and records append-only attempts. Retry is capped with bounded exponential backoff. Permanent/local-policy failures and opted-out contacts are not retried. Cancellation preserves accepted/sent/delivered/read history and cancels only unsent work. Pausing blocks new sends but not webhooks.

```powershell
pnpm.cmd whatsapp:health
pnpm.cmd whatsapp:process
pnpm.cmd whatsapp:process -- --limit=25
pnpm.cmd whatsapp:webhook-fixtures
```

## Quiet hours and LIVE activation

Quiet hours use `Asia/Kolkata` and support overnight ranges. Override requires an urgent/emergency campaign, Director/Super Admin, and a reason.

LIVE requires:

- `WHATSAPP_LIVE_SENDING_ENABLED=true`
- `WHATSAPP_GRAPH_API_VERSION`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_PHONE_HASH_PEPPER`
- active LIVE profile and approved mapping
- successful environment-backed health check
- typed Director/Super Admin activation confirmation

Local webhook QA uses signed MOCK fixtures and needs no public HTTPS. Production still needs supervised HTTPS deployment and Meta subscription.

## Costs, permissions, privacy, backup

Rate reference `META-INR-2026-07-01-REVIEWED-2026-07-17` records the reviewed India rates: Marketing INR 0.8631 and Utility INR 0.1150 per delivered template message. Every estimate states: “Estimate only. Meta charges and classification may change.” No Expense, Budget, fee Payment, Miscellaneous Income, Cash Book, refund, or recurring charge is created.

Sixteen permissions separate centre, non-secret integration, consent, mapping, create, approve, send, schedule, retry, cancel, quiet-hour override, processing, delivery detail, reports, export, and own consent. Director/Super Admin receive all. Principal receives operational controls and intentionally selected override. Admin manages metadata/consent/mapping/create/process/reports but not final approve/send. Accountant/Teacher and Parent receive own consent only. Viewer receives aggregate centre/reports without export or delivery rows.

Reports/CSV are masked and formula-safe. There is no individual “parents who did not read” report, engagement score, or automated read-based targeting.

Backup version 31 includes profiles, consents/events, mappings, batches, deliveries/attempts, webhook deduplication events, and rate references. Restore validates ownership and all links/unique identities, preserves immutable snapshots and opt-out/status history, isolates collisions, and accepts older backups without Prompt 19B arrays.

## Remaining limitations

Meta template creation/status sync is manual. LIVE credentials and public webhook deployment were unavailable for local QA. Estimated cost is not an invoice. No live message was sent. There is no conversational inbox, chatbot, Student direct messaging, media, email, SMS, or push channel.
# Prompt 19C channel boundary

SMS and Email are separate Prompt 19C external channels. They do not replace or reinterpret WhatsApp consent, mappings, batches, delivery evidence, or provider configuration. Each channel has an independent contact-bound consent and queue. See `SMS_AND_EMAIL_ONE_WAY_COMMUNICATION_WORKFLOW.md`. Backup version 33 preserves both foundations. Prompt 19C adds no two-way inbox, OTP, attachment, marketing, or finance posting.

# Prompt 19D PWA boundary

WhatsApp profiles, consent, mappings, batches, provider evidence, reports, webhooks, and APIs remain network-only. Prompt 19D adds no WhatsApp caching, offline send/retry, background sync, push notification, credential storage, or provider change. See `PWA_AND_MOBILE_APP_STRATEGY.md`.
