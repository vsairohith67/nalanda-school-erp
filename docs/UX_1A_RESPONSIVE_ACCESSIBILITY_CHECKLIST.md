# UX-1A Responsive and Accessibility Checklist

Status: implementation checklist; final evidence is in
`UX_1A_QA_REPORT.md`. UX-1A-QA must independently repeat it before merge.

## Required viewports

| Viewport | Login | Authenticated shell | Horizontal overflow |
|---|---|---|---|
| 1440 × 900 | Required | Required | Must be zero |
| 1366 × 768 | Required | Required | Must be zero |
| 1024 × 768 | Required | Required | Must be zero |
| 768 × 1024 | Required | Required | Must be zero |
| 390 × 844 | Required | Required | Must be zero |
| 375 × 667 | Required | Required | Must be zero |
| 320 × 568 | Required | Required | Must be zero |

## Login

- [x] One `main` landmark and one level-one platform heading.
- [x] Exact governed identity; no academic year.
- [x] Truthful Username or email label.
- [x] Username/current-password autocomplete.
- [x] Accessible password visibility control.
- [x] Caps Lock status message.
- [x] Generic anti-enumeration error.
- [x] Duplicate-submit guard, disabled button, spinner, `aria-busy`, live
  progress.
- [x] Existing privacy, terms, and contact routes; no fake reset.
- [x] Light/dark and reduced-motion support.

## Header and account

- [x] Desktop school identity plus role-specific dashboard title.
- [x] One academic-year control.
- [x] Mobile visual order: menu, logo, year, bell, avatar.
- [x] Narrow header does not wrap the school name.
- [x] Visible actions at least 44 px.
- [x] Human name/designation; no raw enum.
- [x] Change Password and Logout are available from the account menu.
- [x] No role picker for single-role users.

## Drawer and keyboard

- [x] Drawer is off-canvas, not document-flow content.
- [x] Opening moves focus to Close navigation menu.
- [x] Tab and Shift+Tab wrap inside the open drawer.
- [x] Escape closes it.
- [x] Focus returns to Open navigation menu.
- [x] Skip link targets `#main-content`.
- [x] Visible focus is at least a 2 px accent outline.

## Semantic and state checks

- [x] Navigation and content have landmarks.
- [x] Group headings are semantic.
- [x] Busy, success, warning, and error feedback uses live/status semantics.
- [x] Unauthorised and 404 surfaces use headings and safe recovery actions.
- [x] Raw IDs, permissions, and role enums are absent from visible state UI.
- [x] No `alert`, `confirm`, or `prompt` is used.
- [x] Status meaning is not communicated only by colour.

## Role matrix

Copied-database synthetic accounts only:

- [x] Super Admin / School Owner
- [x] Director
- [x] Principal
- [x] Admin / School Administrator
- [x] Accountant
- [x] Viewer / Auditor
- [x] Teacher
- [x] Parent

For every role, confirm the default route, named profile, one year control,
permission-derived navigation, no raw enum, zero overflow, and UI logout.
