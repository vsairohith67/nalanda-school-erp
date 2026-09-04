# Communication Operations Runbook

## Normal 1A state

- Parent and all channel flags: OFF, 0%.
- Provider profiles: disabled; secrets absent.
- Real recipients/messages: zero.
- In-app and local synthetic sink: copied/synthetic QA only.

An operator must not change this state under the 1A clearance. Provider setup, live health checks, DNS, sender registration, billing, credentials, real contacts, staging and deployment belong to later gates.

## Safe inspection

Use the communication operations page for aggregate queue/circuit/dead-letter state. Inspect a specific item only under existing least-privilege permission and do not paste its destination/body into tickets or logs. Distinguish business success from queued, accepted, sent and delivered.

## Queue response

1. Confirm parent/channel flag and provider-profile state.
2. Check oldest queue age, expiry, retry count, circuit and safe error category.
3. Do not replay `ACCEPTED_BY_PROVIDER` without reconciliation.
4. Do not retry invalid contact, revoked consent, expired, cancelled, suppressed or permanent-failure items.
5. A dead-letter replay requires later governed operator action, current recipient/consent/contact revalidation, a reason and audit.

Repeated retryable failures open the profile circuit. Allow only a controlled half-open probe after the retry time. A provider recovery is not permission to activate the channel. Never claim recall after provider acceptance.

## Local QA

Set the exact copied-database path under workspace `tmp`, loopback origin, `RELEASE_FEATURE_FLAGS_QA_MODE=SYNTHETIC_COPY_ONLY`, and only the required QA flag keys. Run `pnpm.cmd qa:communication-delivery`. The script migrates fresh/copied/restore SQLite databases, exercises 1,000 in-app and 1,000 outbound items with two workers, failure receipts, and restore twice; it hashes the operational DB before/after and removes only its verified temporary root on success.

Run `pnpm.cmd qa:communication-delivery:independent` and `pnpm.cmd qa:communication-delivery:public-repo-scan`. Preserve a failed QA root as evidence; never upload its database or raw sink payload. The full release gate is recorded in the clearance evidence file.

## Incident boundaries

Provider outage must not modify a Payment, attendance, marks, report, meeting, Support case, Safe Exit, account/MFA state, Offline Sync result or biometric attendance. If the operational DB hash changes during copy-only QA, stop release work, preserve evidence, identify the command/cause and do not merge.
