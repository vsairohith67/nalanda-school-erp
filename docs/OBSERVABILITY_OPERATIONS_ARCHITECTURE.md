# Technical Operations and Observability Architecture

**Control ID:** `OBS-1A`  
**Scope:** local/private operations only  
**Status:** implementation checkpoint; release requires independent QA

## Design

`/technical-operations` is a no-store, server-authorised control plane over existing ERP primitives. It aggregates thirteen domains without replacing Authentication, IAM, Notification Centre, provider profiles, backup, migration history, deployment validation, PWA versioning, module audit trails, or private storage controls.

The lightweight `/api/health` endpoint returns only `{ "status": "ok" }`. Detailed APIs require exact technical permissions and never return secrets, raw paths, recipient identities, business rows, stack traces, file names, salary, marks, complaints, payment references, or provider payloads.

## Data flow

1. Existing sources are queried with count-only or bounded status projections.
2. The aggregator classifies each domain independently.
3. Core application, operational readiness, deployment readiness, and optional-provider conclusions remain separate.
4. Governed deep checks persist bounded evidence and stable fingerprints.
5. Failed conditions deduplicate into alerts; recovery resolves them automatically.
6. Critical alerts publish idempotent in-app Notification Centre campaigns to active Super Admins and Directors holding the exact full technical-operations permission.
7. Incidents and maintenance windows use expected-version transitions and append-only events.

No external monitoring, analytics, payment, AI, WhatsApp, SMS, email, cloud-backup, or OCR provider is activated by rendering or checking this surface.

## Roles

- Super Admin receives all OBS permissions and the full dashboard.
- Director receives only the concise summary by default. Detailed evidence and actions require explicit delegated permissions.
- Other roles receive no OBS navigation or APIs by default.
- `VIEW_SYSTEM_HEALTH` remains compatible with the earlier readiness surface and does not grant OBS action authority.

## Storage and retention

Check definitions, alerts/events, incidents/events, maintenance/events, release manifests, and client policy are logical-backup v40 records. High-volume check runs, metric snapshots, temporary health artifacts, and job-run records are intentionally excluded and bounded by their expiry fields.

## Non-goals

OBS-1A does not deploy the ERP, create production infrastructure, activate providers, onboard real users/data, repair corrupt data automatically, restore from the dashboard, force client reloads, or measure employee performance.
