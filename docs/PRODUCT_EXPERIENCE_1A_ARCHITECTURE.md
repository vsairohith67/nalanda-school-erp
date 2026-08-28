# PRODUCT-EXPERIENCE-1A architecture and acceptance contract

Status: implementation acceptance in progress. This document does not authorise deployment or operational activation.

## Brand ownership

`config/product-brand.ts` is the typed owner of the approved user-facing product name, technical descriptor, native short name, full school name, logo path and school-name font family. Database models, API routes, repository identity, migration history, bundle IDs, audit identifiers and release history are unchanged. `NALANDA PUBLIC SCHOOL` uses Georgia Bold in web/print styles and the existing governed PDF/workbook font embedding paths.

## Complete screen register

`pnpm inventory:product-experience` scans every `app/**/page.tsx` file and regenerates `config/product-experience-screen-register.json`. It records route, inferred roles and permission requirements, module, desktop/mobile/installed availability, online requirement, primary task, risk, empty/loading/error coverage, help status and accessibility review status. The command fails if any page is omitted.

The register is an inventory and review-routing artefact. It never grants access. Middleware, page, route, API and orchestration authorization remain authoritative.

## Role and information architecture

`config/product-experience-personas.ts` defines ten synthetic personas and ten critical tasks per persona. Role navigation continues to be derived from canonical permissions. The shell does not add destinations merely because a page could hide content later. Super Admin retains Command Center, My Work, Universal Search, Smart AI, system/deployment state, security/backup state and controlled feature flags as a grouped current-work surface.

Dashboard summaries are exception-first and bounded to four cards for Super Admin and six for other roles. Full module detail stays in the owning route.

## Student and Staff workspaces

Student 360 requires `VIEW_STUDENTS`, explicitly rejects Parent, Teacher and Student roles, and exposes only section tabs allowed by exact canonical permissions. The identity query is minimal; guardians, academic history, attendance, payments, issued reports, library, meetings, documents and lifecycle data are loaded only for the selected bounded section. Parent linked-child and Teacher timetable scope remain in their separate portals.

Staff 360 composes profile, assignments, attendance, leave, governed documents, account state, payroll summary and a future biometric placeholder. Attendance, leave, documents and payroll tabs require their owning permissions. Salary values and private payroll relations are not duplicated. The biometric tab stores or displays no template, image, card secret, password or vendor database.

## Shared interaction system

The shared product-experience stylesheet defines typography, spacing, focus, semantic status, control/touch sizes, table density, borders, elevation and layout-width tokens. Important status uses text, an icon, semantic colour and an accessible label. Shared loading and safe global error recovery remain privacy-safe.

Authenticated non-GET forms receive a global dirty-state warning for browser close and navigation. Submission does not clear dirty state because a client/server attempt can still fail. Components retain entered values after recoverable failures. Major table wrappers receive header-derived cell labels, sticky header/identity support, a keyboard-focusable overflow region when needed and a stacked mobile row alternative.

## Offline and error vocabulary

The cleared Offline Sync contract remains server authoritative and default off. User-facing states distinguish saved locally, queued, syncing, synced, conflict, rejected, revoked device, stale reference and unavailable server. An offline draft is never a receipt or official transaction.

Recovery review covers validation failure, expired session, revoked permission, network loss, database unavailable, 429, 503, missing object, conflict, incompatible app version, failed download and partial batch results. Messages state the next safe action without stack traces, secrets or record data.

## Platform and performance contract

The native shell reuses existing authorization and Offline Sync boundaries. Product Experience adds safe-area insets, dynamic viewport sizing, 44px controls, visible focus, reduced-motion handling, light/dark adaptation and responsive layout. Windows interactive/package acceptance is local. Android emulator acceptance and iOS simulator compilation/shared UI acceptance are CI gates. Physical-device certification is a separate backlog gate.

Measurements cover dashboard useful paint, Student 360, directory filtering, fee ledger, attendance and marks grids, Universal Search, native launch and offline unlock. Authorization stays server-side; performance fixes may not move private records into permissive client caches.

## Evidence and release boundary

All screenshots and review artefacts use synthetic data and are labelled synthetic. `config/product-experience-bugs.json` is the structured bug register. `config/product-experience-backlog.json` is the confirmed non-blocking follow-up list. Exact-head CI, normal merge, annotated tag and tracker readback remain mandatory. No deployment, rollout, real-user activation or operational database mutation is authorised.
