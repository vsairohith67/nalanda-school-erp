# UX-1A Shared Login and App Shell Specification

Status: implemented on `ux/shared-login-shell-redesign`; independent UX-1A-QA
is required before merge.

## Purpose

UX-1A gives the public sign-in and every authenticated role one consistent,
responsive shell without changing authentication, database models, role
authority, report cards, or Teacher attendance scope. Permission-derived
navigation remains authoritative.

## Governed identity

The sign-in identity is exactly:

- Nalanda Public School
- Nalanda Education Management System
- Unified School Management Platform

The login deliberately shows no academic year. “Nalanda Public School” uses
Georgia Bold with Times New Roman and serif fallbacks. The official governed
JPEG remains the source asset. `public/nalanda-logo-transparent.png` is a
deterministic background-only derivative created by
`tools/export-transparent-logo.ps1`; the source asset is never overwritten.

## Before-state audit

The implementation audit recorded these visible defects before changes:

- Login said “Nalanda Fee Control 2026-27”, included an academic year, used a
  narrow single-column card, and had no governed policy/support links.
- Login failures exposed differing backend text. The password visibility
  control was text-only; Caps Lock, duplicate-submit, and accessible busy
  feedback were absent.
- Desktop and mobile duplicated the academic year between sidebar and header.
- The profile control exposed `SUPER_ADMIN` and consumed 148 px on mobile.
- The mobile school name wrapped over three lines and made the header about
  112 px high.
- The academic-year selector contained only the current setting; no governed
  historical switch or year-creation workflow exists.
- System Health combined core runtime health and deployment readiness.
- The unauthorised page exposed the raw role enum.
- The existing mobile drawer already trapped focus, closed on Escape, and
  returned focus; UX-1A preserved those behaviours.
- A production build was needed for reliable browser QA. The strict production
  CSP is intentionally preserved; Next development mode currently requests
  `unsafe-eval`, so dev-only hydration under that CSP remains a documented
  toolchain limitation rather than a reason to weaken security.

## Public sign-in contract

- Identifier label: `Username or email`, matching the current backend.
- Password uses `autocomplete="current-password"`; identifier uses
  `autocomplete="username"`.
- Visibility is an accessible eye icon with a changing label and pressed
  state.
- Caps Lock status is announced without changing the password value.
- Every ordinary failure, including malformed, missing, disabled, unknown,
  wrong-password, rate-limit, and server-error outcomes, maps to:
  `We couldn’t sign you in with those details.`
- A client-side in-flight guard and disabled submit prevent duplicate login.
- `Signing in…`, a spinner, `aria-busy`, and a polite live region provide
  accessible progress.
- Privacy Policy, Terms of Use, and Contact Support point to existing public
  routes. There is no fake Forgot Password action.
- The API remains private/no-store, retains strict cookies, rate limiting,
  disabled-account denial, credential-tag sessions, and hash-only safe log
  correlation. It no longer returns the raw User ID.

AUTH-2B owns future verified login aliases, reset channels, central session
inventory, and single-use password-reset links. No password may be recovered,
displayed, or emailed.

## Change-password contract

The existing current-password-gated route remains the only own-password
workflow. It requires current, new, and confirmation values; enforces 12–128
characters, rejects common/repeated values, and rejects reuse of the current
password. A successful change:

1. writes a new scrypt hash transactionally;
2. appends privacy-safe `OWN_PASSWORD_CHANGED` audit evidence;
3. invalidates all stale sessions through the credential tag;
4. expires the current cookie; and
5. returns the user to login with a safe success message.

No existing password is displayed, recovered, logged, or sent.

## Authenticated shell contract

Desktop header:

- official mark and school name;
- one concise role-specific dashboard title;
- one current academic-year control;
- notification control when permitted;
- compact named profile menu with human designation.

Mobile order:

`[menu] [logo] [year] [bell when permitted] [avatar]`

The header is 64 px at the mobile breakpoint. School name text is omitted from
the narrow row rather than wrapped. Visible controls are at least 44 px. The
profile uses initials, display name, and a human designation such as School
Owner, School Administrator, or Viewer / Auditor. Raw role enums and
permission tokens are not rendered.

The account menu exposes Change Password, Install App, Appearance, and Logout.
Single-role users have no role picker. IAM-1A owns future multi-role context
and named per-user grants/denials.

## Academic-year boundary

The selector exists only inside the authenticated ERP and shows the current
`SchoolSettings.academicYear`. There is no historical academic-year context
model, permitted switch action, or year-creation workflow in the current
repository. UX-1A does not invent one. Any future year management must define
history, object scoping, permissions, backup/restore, and report consistency
before the control becomes multi-option.

## Health and readiness

Authorised health roles see separate “Core application health” and
“Deployment readiness” blocks. Ordinary roles receive only their permitted
operational dashboard content. OBS-1A is the future monitoring phase; UX-1A
adds no Sentry, PostHog, telemetry provider, or credential.

## Security invariants

UX-1A preserves:

- middleware same-origin/CSRF and body-size controls;
- generic account-enumeration-safe login feedback;
- private/no-store authentication and password responses;
- secure, HTTP-only, SameSite-strict session cookies;
- active-account, role, permission, and object-scope enforcement;
- credential-tag invalidation after password/status/role changes;
- no credential or raw permission logging;
- no raw IDs or permission tokens in visible UI;
- copied-database-only synthetic role QA.

## Deferred boundaries

- `AUTH-2B`: verified aliases, reset channels, central sessions, ownership.
- `IAM-1A`: named accounts, reusable profiles, per-user grants/denials, and
  multi-role context.
- `SUPPORT-1A`: approved support channel, service ownership, hours, and safe
  support intake beyond the current public Contact route.
- `OBS-1A`: approved redacted monitoring, alerting, retention, and incident
  ownership.

## Release gate

Do not merge this branch before independent UX-1A-QA replays the copied
fixture, seven viewports, themes, role shells, login/error/logout/password
states, commands, operational identity, external re-fetches, and no-merge
check.
