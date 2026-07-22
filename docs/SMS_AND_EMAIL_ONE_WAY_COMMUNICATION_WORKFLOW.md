# SMS and Email One-Way Communication Workflow

Review date: 2026-07-18

## Scope and safety boundary

Prompt 19C adds two separate external channels for one-way school operational communication to consented Guardians and Staff: SMS and Email. It reuses published Prompt 19A campaigns and immutable `NotificationRecipient` snapshots. It does not add inbound conversations, replies, OTP/login messages, newsletters, marketing, attachments, arbitrary HTML, remote images, tracking pixels, student-direct delivery, or finance posting.

Both channels default to deterministic MOCK providers. SMS LIVE and Email LIVE are disabled. No live activation or real contact is authorised during Prompt 19C or Prompt 19C-QA.

## Official source review

The following official sources were reviewed on 2026-07-18:

- TRAI, [Advice to Senders](https://www.trai.gov.in/advice-to-senders): Principal Entity registration, registered headers, registered content templates, registered consent-template/consent where applicable, and transmission of PE ID, header and content ID are part of the sender traceability chain.
- TRAI, [Telecom Commercial Communications Customer Preference Regulations amendments published 12 February 2025](https://cms.trai.gov.in/sites/default/files/2025-02/Regulation_12022025_0.pdf): current content-template controls include variable governance and one-header-per-content-template linkage. The exact current TSP/DLT code of practice must be rechecked during supervised activation.
- Google Developers, [Create and send email messages](https://developers.google.com/workspace/gmail/api/guides/sending): Gmail API messages are MIME/RFC-compliant messages encoded as base64URL in the `raw` field and sent with `users.messages.send`.
- Google Developers, [`users.messages.send`](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send): the minimum suitable listed OAuth scope is `https://www.googleapis.com/auth/gmail.send`.
- Google Workspace, [Set up SPF](https://support.google.com/a/answer/33786): SPF is a DNS TXT control covering every sender for the domain; Google recommends DKIM and DMARC as well.
- Google Workspace, [Set up DKIM](https://support.google.com/a/answer/174124): DKIM must be configured and verified for the sending domain before live activation.
- Google Workspace, [Set up DMARC](https://support.google.com/a/answer/2466580): DMARC is a DNS policy/reporting control and requires domain alignment with authenticated SPF or DKIM.
- Google, [Email sender guidelines](https://support.google.com/mail/answer/81126): use authenticated domains, RFC-compliant messages, consented traffic, steady conservative rates, and monitoring; avoid sudden bursts and reduce volume after bounces or deferrals.
- Google Workspace, [Gmail sending limits](https://support.google.com/a/answer/166852): limits can change, apply across rolling periods and account types, and must be checked at activation time. No quota is hard-coded in this application.

No SMS provider-specific documentation was reviewed because no selected SMS provider contract, credentials, or adapter exists in the repository or environment. The application therefore does not guess a vendor payload, endpoint, signature, price, or delivery-report format.

## Contact authority and normalisation

- Guardian SMS authority: `Guardian.primaryMobile`.
- Guardian Email authority: `Guardian.email`.
- Staff SMS authority: `StaffMember.mobile`.
- Staff Email authority: `StaffMember.email`.
- Ownership is the authenticated Parent `User.guardianId` or active `StaffMember.userId`.
- SMS uses the tested E.164 validation rules. Approved visual separators may be trimmed. A missing country code is never silently invented: `+91` may be shown in preview and requires explicit confirmation.
- Email trims outer whitespace, rejects display-name syntax and multi-address input, lowercases the domain only, and preserves the local part exactly. This avoids unsafe provider-specific assumptions about local-part case or dot semantics.
- Consent binds channel, exact subject and a keyed hash of the exact canonical contact. Only a masked contact is copied into channel tables.
- A changed source phone/email invalidates the old contact-bound consent for sending. Source contacts are never silently rewritten.
- Exact canonical contact hashes are deduplicated inside a batch. Ambiguous contacts are skipped; they are not reassigned.

## Provider decision

### SMS

`MockSmsProvider` is deterministic and performs no network request. The `SmsProvider` interface includes health, approved-template send and signed delivery-report parsing. There is no generic live HTTP sender.

LIVE health result: **SMS provider selection required.**

LIVE prerequisites:

- explicit environment feature flag;
- selected adapter backed by the provider's current official contract;
- environment-only credentials and verified health;
- Principal Entity registration;
- registered header;
- registered DLT content template and exact mapping;
- consent-template/consent compliance where applicable;
- PE/header/content traceability fields;
- cost and rate controls;
- Director or Super Admin confirmation.

### Email

`MockEmailProvider` is deterministic and performs no network request. `GmailApiEmailProvider` uses a dedicated Workspace mailbox or approved send-as alias, environment-only OAuth values, the `gmail.send` scope, a plain-text MIME message, base64URL payload, request timeout and safe errors.

The Gmail adapter never stores OAuth tokens in the database and never exposes configuration values in the UI or logs. It sends one logical message per contact with no attachment, BCC mass-send, tracking pixel, arbitrary HTML, or remote resource.

A successful Gmail API response means `ACCEPTED`, not final inbox delivery. Gmail API alone does not provide the delivery/bounce/complaint webhook evidence implemented by the MOCK fixture interface. Without valid provider evidence the application must not create `DELIVERED`, `BOUNCED` or `COMPLAINED`.

LIVE prerequisites:

- explicit environment feature flag;
- dedicated `nalandaps.com` sender mailbox or approved alias;
- environment-only OAuth configuration and health check;
- verified sender identity;
- verified SPF and DKIM;
- reviewed DMARC status and alignment;
- conservative locally configured limits, rechecked against current Google guidance;
- approved Email mapping;
- Director or Super Admin confirmation.

The application records operator-reviewed SPF/DKIM/DMARC states. It does not modify DNS and does not claim a domain control is configured without evidence.

## Consent and suppression

SMS and Email consent are independent and unchecked by default. Existing stored contact data is not consent. Parent and Staff portals manage only the authenticated subject. Paper, office or evidence-backed imported consent requires an evidence reference. Opt-out is immediate and history is append-only.

Email hard bounce, complaint, provider suppression and invalid-address events create contact-hash-bound suppressions. Suppression blocks sending and retry. Clearing requires an authorised reviewer and a reason; a new portal opt-in does not clear suppression automatically.

## Templates, queue and evidence

SMS LIVE requires exact approved DLT text/header/template identity and parameters only in approved positions. Email mappings are plain-text subject/body templates with a narrow reviewed variable allowlist. Historical campaign, template, rate, domain and DLT snapshots remain immutable after approval.

Preview resolves contacts and produces masked counts/samples only; it creates no deliveries or attempts. Approval and send are separate. Queue claims are bounded and database-backed. Send time rechecks ownership, current contact hash, consent, suppression, template/profile readiness, quiet hours, local rate limits and the exact estimated-cost cap snapshot.

MOCK SMS can progress through signed delivery fixtures. MOCK Email can generate accepted, transient/permanent failure, hard-bounce, complaint and suppression fixtures. Webhook payloads are redacted, deduplicated, signature-checked and monotonic. No inbound message content or automatic reply is stored.

Cost and segment figures are estimates only. SMS distinguishes GSM-compatible and Unicode segment rules. Rates are operator-entered, versioned references; no provider price is hard-coded and no Expense, Budget, Payment, Cash Book or Miscellaneous Income entry is created.

## Supervised activation checklist

Live activation remains a later, supervised operation:

1. Re-review every official source and the exact selected provider contract.
2. Confirm the dedicated sender identities and allowed aliases.
3. Complete DLT or SPF/DKIM/DMARC readiness with evidence.
4. Configure secrets only in the process environment.
5. Run `pnpm.cmd sms-email:health`.
6. Configure deliberately conservative hourly/daily limits, worker chunk size and cost caps.
7. Approve mappings against registered/provider identities.
8. Confirm Director or Super Admin authorisation in an accessible application dialog.
9. Perform a separately authorised, tightly controlled activation test.

Prompt 19D is outside this workflow.

## Prompt 19D PWA boundary

SMS/Email profiles, consent, suppressions, templates, batches, queues, provider evidence, delivery reports, webhooks, and APIs remain network-only. The PWA adds no offline send/retry, background sync, push notification, tracking, contact storage, or provider change. See `PWA_AND_MOBILE_APP_STRATEGY.md`.
