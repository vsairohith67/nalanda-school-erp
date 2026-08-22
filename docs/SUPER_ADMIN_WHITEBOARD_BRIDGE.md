# Super Admin Whiteboard Bridge

- **Prompt:** `WHITEBOARD-BRIDGE-1A`
- **Release status:** `CLEARED`
- **Route:** `/super-admin/whiteboard`
- **Authorisation:** exact active `SUPER_ADMIN` role only
- **Database change:** none

## Canonical board

The only authorised board is:

`https://app.canvs.io/gdrive?id=1LzTSjaWjpOaHppTtyXqICkMbEgHbT6T-`

The destination is a fixed non-secret application constant. The optional
non-secret `NALANDA_CANVS_WHITEBOARD_URL` configuration is accepted only when it
is byte-for-byte the canonical HTTPS URL after strict URL validation. The host
must be exactly `app.canvs.io`, the path must be exactly `/gdrive`, and the only
query value must be the exact canonical board ID. Empty, malformed, additional,
alternate, encoded, redirected, or user-controlled destinations fail closed and
the page renders no external link.

## Exact Super Admin boundary

The page and sidebar entry require the existing authenticated shell plus
server-side `requireRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN")`. Director,
Principal, Accountant, Admin, Computer Operator, Teacher, Parent, Student, Gate
Staff, Viewer, the reserved `MARKS_ENTRY_OPERATOR` profile, and every delegated
or custom role are denied. Hiding navigation is only a presentation control; the
server-side page guard remains the authorisation boundary for direct requests.

## External-launch architecture

The ERP presents a short reference page and opens the canonical Canvs board as
an external destination in a new tab. The link uses `noopener`, `noreferrer`, and
a no-referrer policy. It does not append ERP route state, session data, Student
IDs, user IDs, tokens, or other user-controlled parameters. The accessible link
text and visible note communicate that a new tab opens.

Board editing happens in Canvs. Changes made in Canvs are not stored by the ERP.
The bridge intentionally has:

- no iframe or cross-origin embedded authentication;
- no OAuth, SSO, Canvs token, shared cookie, credential forwarding, `postMessage`
  authentication, webhook, or MCP credential in the ERP;
- no server-side Canvs fetch, scrape, download, polling job, cache, snapshot,
  synchronization table, or board-content persistence;
- no drawing, Excalidraw, Mermaid, upload, collaboration, history, or other
  whiteboard-engine functionality;
- no schema migration or operational-data write;
- no Universal Search source, index, adapter, ranking change, or board content;
- no Smart AI, RAG, embedding, vector storage, or provider call.

`library.excalidrawlib`, where present in project sources, remains outside this
feature and is not loaded, parsed, copied, embedded, or added as a dependency.

## Independent QA clearance

`WHITEBOARD-BRIDGE-1A-QA` cleared the bridge on 2026-08-22. Runtime tests denied
the direct route and navigation entry to Director, Principal, Accountant,
Admin, Computer Operator, Teacher, Parent, Student, Gate Staff, Viewer, and a
delegated dashboard profile while allowing the exact Super Admin context.
Encoded, redirected, protocol-relative, alternate-host, `javascript:`, `data:`,
`file:`, and arbitrary HTTPS destinations could not replace the canonical link.

Desktop 1366 x 768 and exact mobile 390 x 844 checks passed in light and dark
modes for the Command Center card and Whiteboard page. The action remained at
least 44 px, keyboard focus was visible, no horizontal overflow occurred, the
invalid-configuration state rendered no outbound link, and the browser console
contained no error, warning, or hydration entry. A complete security diff scan
returned zero findings.

The sequential release gate passed 338 page routes, 551 API routes, lifecycle
dry run, typecheck, 1,950 tests with 3 intentional qpdf-dependent skips,
production build, backup version 41, and Git safety. The operational database
remained byte-identical at SHA-256
`65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`.
No migration, board row, sync state, Search source, or Smart AI integration was
added. Release tag: `super-admin-whiteboard-bridge-v41-2026-08-22`.

## Privacy, cache, and audit boundary

The route is dynamic and no-store within the authenticated application shell.
The page displays no private ERP record and sends no ERP data to Canvs. This
phase does not add a click-audit database write because the launcher is required
to remain database-neutral and no existing policy mandates a new event for this
reference action. Any future access-action audit must be separately governed and
limited to privacy-safe actor/action/time/result metadata; it must never record
board contents, cookies, tokens, or third-party browser details.

## Future governance

Any future embed, board metadata, Search participation, Smart AI use, token/API
exchange, synchronization, audit write, or in-ERP whiteboard capability requires
a separate prompt, threat model, privacy review, authorisation design, retention
decision, tests, and independent clearance. This bridge does not unlock Smart
AI; `UNIVERSAL_SEARCH_CLEARED` remains a separate prerequisite.
