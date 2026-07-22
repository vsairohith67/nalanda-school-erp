# AI Assistant Safety and Read-Only Retrieval Workflow

## Purpose and decision

Prompt 20A adds a leadership-only assistant for two narrow uses:

1. answer questions from an explicit allowlist of local project documentation;
2. summarize operational modules through handwritten aggregate-only read tools.

The assistant is not an autonomous agent. It cannot write school records, run SQL, execute shell commands, browse the filesystem, call unrestricted URLs, send messages, or use arbitrary external sources. The deterministic `MOCK` provider is the only provider that may be active in this phase. Local HTTP and cloud adapters are present only as disabled architecture boundaries.

## Pages, APIs, and permission defaults

Staff pages are `/ai-assistant`, `/ai-assistant/settings`, `/ai-assistant/sources`, `/ai-assistant/audit`, and `/ai-assistant/evaluations`. Their APIs are under `/api/ai-assistant/**`. Every page and API performs a server-side permission check.

| Role | Default access |
| --- | --- |
| Super Admin / Director | Documentation, aggregate tools, settings, sources, audit, evaluations |
| Principal | Documentation, aggregate tools, audit |
| Admin | Documentation only |
| Viewer / Accountant / Teacher / Parent | No assistant access |

The seven independent permissions are `VIEW_AI_ASSISTANT`, `USE_AI_ASSISTANT_DOCUMENTATION`, `USE_AI_ASSISTANT_AGGREGATES`, `MANAGE_AI_ASSISTANT`, `MANAGE_AI_ASSISTANT_SOURCES`, `VIEW_AI_ASSISTANT_AUDIT`, and `RUN_AI_ASSISTANT_EVALUATIONS`. Changing a role default does not bypass the API checks or source-policy role allowlists.

## Retrieval allowlists

Documentation retrieval reads only the files registered in `lib/ai-assistant-documents.ts`. There is no recursive directory scan. Paths must be simple filenames inside `docs`, symlinks are refused, oversized files are skipped, and credential-like code blocks are removed before evidence is built. Retrieved documentation is labelled untrusted evidence and cannot modify system safety instructions.

Aggregate retrieval uses only the registry in `lib/ai-assistant-tools.ts`. It includes school overview, enrollment, fee collection, Student attendance, Staff attendance/leave, Homework, exams, report-card completion, library, certificate/Class X, communications, and release-checkpoint summaries. These functions use fixed Prisma reads and fixed output fields. They do not accept model-generated filters, model-generated SQL, record IDs, names, contact fields, free-form order clauses, or mutation instructions.

The minimum privacy group is five. Non-zero numeric groups below the active threshold are replaced by a threshold warning. Tool calls are bounded, rows are bounded, and any missing source value makes completeness partial rather than encouraging a guess.

## Prohibited data and actions

Both source-policy metadata and server code prohibit passwords and hashes; phone, WhatsApp, email, address, Aadhaar, caste, religion, disability and medical data; bank, salary, tax, EPFO and ESI data; individual Student marks/report cards; private Teacher analytics; and Student or Teacher rankings. The assistant must also refuse:

- instruction overrides, system-prompt requests, secrets, credentials and environment access;
- SQL, shell, source-code, arbitrary-file and backup/log retrieval;
- create, edit, delete, approve, issue, publish, send, import, export or configuration changes;
- arbitrary URLs, internet search, Gmail, Google Drive, SharePoint, Notion, or other unregistered sources;
- individual-level operational or academic analysis.

Input is classified before retrieval. Evidence is redacted before it reaches a provider. Provider output is schema-validated, citation-validated, redacted again, stripped of unsafe HTML/remote links, and refused if it fabricates or omits required citations.

## Answer contract

An accepted answer contains plain text, allowed citation identifiers, a generated timestamp, source timestamps, and a completeness state. Facts, calculations, interpretation, uncertainty, stale-source warnings, missing evidence, and below-threshold results remain distinguishable. The UI does not treat an unsupported claim as authoritative.

Conversation state is held only in the current browser component and is not restored after a reload. Clearing the conversation uses an accessible in-app confirmation dialog. Questions and full answers are not written to the database.

## Limits, rate control, and failure behavior

The default profile limits are a 1,000-character question, 12,000 context characters, three tool calls, 100 rows per tool, ten-second timeout, minimum aggregate group of five, hash-only logging, and 90-day audit retention. Editable values remain within fixed server-side ranges. Each application process permits eight requests per user per minute and one concurrent request per user. A scaled deployment needs a shared rate-limit store before enabling any live provider.

Timeout, profile pause, permission failure, unavailable source, malformed provider output, missing/fabricated citation, and unsafe content fail closed with a safe reason. No fallback performs a network call or widens the source set.

## Provider lifecycle

`FOUNDATION-MOCK-READONLY` is the durable active profile. Only a `MOCK` profile can be activated, and activation requires the exact confirmation text shown by the UI. Pausing and health checks use accessible in-app dialogs. A MOCK health check performs no network request.

`LOCAL_HTTP` remains disabled. The adapter validates loopback hosts only and cannot activate in Prompt 20A. A later local-model phase requires a selected runtime, pinned model/version, process isolation, authentication or OS boundary, request-size limits, no model tool execution, documented resource capacity, shared throttling, timeout/cancellation tests, and supervised privacy/security QA.

`CLOUD_API` remains disabled and has no credential column or credential UI. A later cloud review must explicitly approve provider terms, data retention and training policy, processing location, sub-processors, contractual controls, incident handling, redaction adequacy, credential storage/rotation, egress allowlist, cost/quotas, model/version pinning, deletion/DSAR obligations, and a real-data prohibition or approved data-processing basis. Passing Prompt 20A does not approve cloud use.

## Privacy-safe audit and evaluations

Query audit rows contain user/profile identifiers, mode, SHA-256 question and answer hashes, safety decision/reason code, allowlisted tool keys, counts, redaction count, latency, timestamps, provider kind/model reference, and expiry. They never store the question, answer, retrieved bodies, system prompt, contact values, credentials, headers, cookies, tokens, IP address, or device fingerprint. Safety events contain only an allowlisted category, severity, safe reason, and bounded safe metadata.

Evaluation cases contain synthetic questions only. Runs record counts and a safe per-case decision summary. The deterministic suite covers documentation, aggregate retrieval, prompt injection, prohibited personal data, mutation/SQL, and permission behavior.

## Backup, restore, and collision policy

Backup version 34 includes the six AI arrays: profiles, source policies, query audits, safety events, evaluation cases, and evaluation runs. Export validation rejects credential-like fields, unsafe live-provider state, invalid hashes, broken profile/audit/run/user links, and duplicate identities. Questions, answers, evidence bodies, provider secrets and endpoints do not exist in these records and therefore cannot be exported.

Restore is additive and collision-aware. Existing local profiles/policies are preserved when newer; live local/cloud state is forced disabled; audit ownership must map to an existing restored/local User; safety events and evaluation runs are append-only; and older backup versions default the six arrays to empty.

## Operator and QA procedure

Use `pnpm.cmd qa20a:fixtures setup` only for local deterministic Browser QA. It creates `qa20a-*` role accounts, a `QA20A` MOCK profile, temporary `QA20A` policy codes, and synthetic cases. It never enables local/cloud use. Run `pnpm.cmd qa20a:fixtures cleanup` after QA, then run it a second time to prove idempotent zero counts. Cleanup removes QA profiles, policies, audits, safety events, cases, runs and users, restores the durable MOCK foundation, and leaves live provider counts at zero.

Release verification order is:

1. `pnpm.cmd routes:list`
2. `pnpm.cmd lifecycle:backfill`
3. `pnpm.cmd typecheck`
4. `pnpm.cmd test`
5. `pnpm.cmd build`
6. Browser QA in the optimized production build
7. QA cleanup twice
8. `pnpm.cmd backup`

The final backup must be created after cleanup.

## Known limitations

- MOCK wording proves the contract and safety controls; it is not a language-quality evaluation.
- Keyword routing and deterministic document-section matching are intentionally conservative.
- In-memory rate/concurrency state is per process, not distributed.
- Documentation freshness uses file modification time and a configured warning age; it is not an external truth check.
- Aggregate values depend on current local data quality and may be partial.
- No semantic/vector database, embeddings, OCR, attachment ingestion, speech, internet search, autonomous planning, write action, external communication, or live AI provider is included.

## Prompt 20B separation

The handwritten fee-register workflow is a separate private OCR staging module; it is not an AI Assistant attachment or tool. Register images, OCR rows, Student candidates, and review evidence are never exposed to Assistant retrieval. PWA caching also remains prohibited. Prompt 20B raises the current backup format to version 35 while preserving the six version-34 Assistant arrays.

Prompt 20C raises the ERP backup to version 36 while preserving those six arrays. Cloud-backup profiles, runs, hashes, health, reports, and rehearsals are not Assistant tools or sources. The Assistant cannot start, verify, prune, or restore backups; inspect provider objects; read keys; or retrieve decrypted contents.
