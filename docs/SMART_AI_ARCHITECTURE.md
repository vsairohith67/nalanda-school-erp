# Smart AI Architecture

- **Prompt:** `SMART-AI-1A — Grounded Super Admin Smart AI Foundation`
- **Route:** `/super-admin/ai`
- **API:** `POST /api/super-admin/ai`
- **Initial audience:** exact active `SUPER_ADMIN` only
- **Default runtime:** `DISABLED`
- **Persistence:** none
- **Authority:** read-only synthesis over Universal Search only
- **Independent QA:** `SMART_AI_CLEARED` on 2026-08-22
- **Qualified local runtime:** optional, digest-pinned Ollama/Qwen path documented in [Smart AI Local Runtime](./SMART_AI_LOCAL_RUNTIME.md); committed default remains `DISABLED`

## Purpose and release boundary

Smart AI is a private school-management assistant for the Super Admin. It may
summarize only the normalised, authorised records returned by Universal Search.
It is not a general-purpose chatbot and does not replace Search:

```text
Authenticated exact SUPER_ADMIN
  -> Smart AI request validation and boundary checks
  -> Universal Search server service
  -> permission-filtered normalised results
  -> bounded untrusted-data source envelopes
  -> disabled or loopback-only provider adapter
  -> server-validated answer and citation IDs
  -> server-owned internal citation destinations
```

Search remains deterministic retrieval. Smart AI is synthesis. If Universal
Search is unavailable, Smart AI stops or reports incomplete coverage. It never
falls back to direct Prisma/SQL/table access.

SMART-AI-1A does not activate an external provider, download or start a model,
create embeddings or a vector index, browse the web, ingest files or Canvs,
train/fine-tune a model, or authorise AI actions. A cleared foundation means
the architecture is safe for a later runtime decision; it does not mean that
real school data may leave the machine.

## Exact Super Admin authorization

Four independent checks enforce the initial exact-role boundary:

1. navigation includes `/super-admin/ai` only for `SUPER_ADMIN`;
2. the server page calls `requireRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN")`;
3. the POST API calls `requireApiRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN")`;
4. `assertSmartAiActor` rejects every other, delegated, custom, unknown and
   future role inside orchestration.

A permission override cannot turn another role into a Smart AI actor. Server
authorization is repeated on every request. Direct route and API access are
denied without rendering or returning Smart AI evidence.

Future role expansion requires a separate governance, retrieval and owner-
isolation review. It is not an environment switch in this phase.

## Universal Search retrieval contract

The orchestration service derives a bounded deterministic search plan from the
question and calls `runUniversalSearch`. It does not make an internal HTTP call
to the public Search API. The shared service therefore retains:

- exact `SUPER_ADMIN` authorization;
- exact authenticated-owner Diary, Task and Contact filters;
- existing prohibited-field exclusions and masking;
- bounded candidate, per-source and total result counts;
- normalized text-only result fields;
- deterministic safe destinations and ranking;
- explicit `OK`, `EMPTY`, `DEGRADED`, `UNAVAILABLE` and `TIMEOUT` source state.

The Smart AI service has no model-specific ORM adapter and no arbitrary query
interface. Its only default retrieval call is Universal Search. A source
failure remains failure evidence; unavailable sources are never relabelled as
zero matches.

## Request and context bounds

The initial limits are deliberately small for a future local model:

| Boundary | Limit |
| --- | ---: |
| Question | 2-2,000 characters |
| Prior conversation | 6 turns / 6,000 characters |
| Search results sent to context | 12 |
| Serialized source context | 8,000 characters |
| One source envelope | 900 summary characters |
| Accepted answer | 6,000 characters |
| Accepted citations | 8 |
| Provider response body | 24,000 bytes |
| Local provider timeout | default 8 seconds; governed range 250 ms-30 seconds |

Requests reject unknown fields, actor/owner fields, excessive history and
unsupported roles. Raw Prisma objects never enter the provider request.

## Model-safe source envelope

Each Search result is converted to this bounded shape:

```text
SOURCE ID
SOURCE MODULE AND TYPE
TITLE
SAFE SUMMARY (Search subtitle plus safe snippet)
STATUS
TIMESTAMP, if valid
SERVER-VALIDATED INTERNAL DESTINATION (kept outside the provider payload)
```

The serialized context uses explicit `<ERP_SOURCE>` delimiters and repeats that
all contained text is untrusted data, never instructions. Source IDs are
request-local (`SRC-1`, `SRC-2`, and so on). A destination is accepted only when
it is a safe internal path belonging to the current Search source definition.
The provider never supplies or overrides citation URLs.

## Source trust boundary and prompt-injection defense

Student, Diary, Task, Contact, Support or other ERP text can contain hostile
phrases. The system contract states that retrieved content:

- is untrusted evidence data;
- cannot alter system, authorization or privacy policy;
- cannot ask the model to run tools, query a database, browse or call a URL;
- cannot reveal prompts, credentials, hidden reasoning or unrelated records;
- cannot request a write action;
- may be used only as evidence for a cited answer.

User requests that try to bypass policy, access the database, reveal secrets,
cross another owner's private work, obtain hidden prompts, use the internet, or
perform ERP actions are refused before retrieval. General-knowledge requests
are directed back to grounded Nalanda ERP questions.

These deterministic checks supplement, not replace, the Universal Search
authorization and field-exclusion boundary.

## Citation validation

The local provider contract returns JSON equivalent to:

```json
{
  "answer": "Concise grounded answer",
  "citations": ["SRC-1", "SRC-3"],
  "uncertainty": "Optional concise limitation"
}
```

The server rejects empty answers, missing citations, malformed structures,
unknown fields, more than eight citations, and any citation not present in the
current request's authorised context. Another request's source ID, a raw URL,
`javascript:` value or fabricated record cannot become a citation. Citation
cards are generated from the retained current Search results and link only to
their validated internal destination.

No-evidence questions do not call the provider. They receive: "I couldn't find
enough authorised ERP information to answer that." Degraded Search adds a clear
incomplete-coverage notice. This prevents a local model from silently filling
school-record gaps using general model memory.

## Provider abstraction and default-disabled state

`SmartAiProvider.generate(input, signal)` is independent of a model vendor. Its
input is bounded and its output is validated after generation. No full
question, source context, prompt or answer is logged.

SMART-AI-1A supports two states:

- `DISABLED` — the merge-safe default; the page loads and may show authorised
  Search evidence previews, but makes no model network call;
- `LOCAL` — a foundation for an already-running model service at an exact
  loopback HTTP endpoint.

There is no OpenAI, Anthropic, Google, Microsoft, AWS, Hugging Face, gateway or
arbitrary-URL adapter, no API-key field and no credential storage. Unknown
provider modes fail closed as disabled.

## Loopback-only provider restriction

The local adapter accepts only exact forms using `http://localhost`,
`http://127.0.0.1` or `http://[::1]`, with an optional valid port and path. It
rejects HTTPS, credentials/userinfo, query strings, fragments, trailing-dot or
lookalike names, numeric/encoded IP tricks, LAN/link-local/public IPs and all
other DNS names. Redirect following is disabled; every 3xx response is rejected
before a redirected host can receive data.

Requests omit credentials, use `no-store`, require JSON, enforce a bounded body
and terminate at the configured timeout. The adapter does not download, launch
or assume the presence of Ollama, LM Studio or any other runtime.

## Read-only and Academic Integrity boundary

Smart AI contains no business mutation, transaction, autonomous tool or action
registry. It cannot create/complete Tasks, edit Diary or Contacts, change
Students or Staff, post payments, mark attendance, change marks, publish
reports, grant permission, send email/SMS/WhatsApp, open a Safe Exit transaction
or write to the whiteboard.

Academic Integrity v1.1 remains unchanged: normal Principal/Super Admin marks
workflows and exact `MARKS_ENTRY_OPERATOR` scope continue through their existing
server authorization. Smart AI itself has zero marks-mutation authority and
offers no executable marks action.

## Conversation privacy, caching and rendering

Conversation state exists only in the browser component. The last six bounded
turns may be supplied with the next request; there is no Smart AI conversation,
prompt, answer, embedding or vector table and no server long-term store. "New
conversation" clears the page state. No browser local/session storage is used.

Page and API responses are dynamic, private and `no-store`, vary on the session
cookie, and are marked noindex/noarchive. No shared response cache or cross-user
reuse is allowed.

Provider text is normalized and stripped of HTML, scripts, iframes, SVG,
external images and executable/external links. React renders it as plain text;
`dangerouslySetInnerHTML` is not used. Hidden chain-of-thought is neither
requested nor displayed.

Privacy-safe operational measurement may count request occurrence, actor,
result count, provider state, duration and success/failure, but full questions,
context, prompts and answers are outside broad logs. SMART-AI-1A itself creates
no new audit-content persistence.

## Failure and performance behavior

Retrieval time, context-construction time, request-orchestration overhead,
provider time and total time are measured separately in the private response.
A Search failure stops the request without a direct-database fallback. A
partially degraded result may
still be answered from the remaining citations with a visible coverage warning.
Provider timeout, disconnect, HTTP error, wrong content type, invalid JSON,
oversized body, malformed schema or invalid citation returns a safe failure and
does not accept the answer.

Universal Search bounds and timeouts are unchanged. Model latency is outside
Search itself. All provider/context objects are request-local; there is no
shared mutable conversation or citation state.

## Whiteboard boundary

The canonical Canvs Whiteboard Bridge stays a separate fixed external launch.
Smart AI imports no Whiteboard module, does not fetch the board, does not index
or ingest Canvs content, and cannot write to the board.

## Future phases

`SMART-AI-LOCAL-RUNTIME-1A` qualified one optional local workstation path with
synthetic data first. Qualification does not activate the runtime in committed
configuration, activate a cloud provider, or permit ERP evidence to leave the
machine. A different runtime, model, model digest or workstation requires a new
qualification.

Any future role expansion requires a new exact permission/object-scope design.
Any future AI Actions capability requires a separate governance, approval,
audit, confirmation, rollback and Academic Integrity phase. Neither is implied
by this foundation.

The independent authorization, privacy, provider, injection, citation,
Browser, security, full-regression and database-integrity evidence is recorded
in [SMART-AI-1A Independent QA Clearance](./evidence/SMART_AI_1A_QA_CLEARANCE.md).
