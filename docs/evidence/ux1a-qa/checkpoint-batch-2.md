# UX-1A-QA recovery checkpoint — Batch 2

Date: 2026-07-30

Status: PASS

Exact responsive matrix completed for both light and dark themes:

- 1440x900
- 1366x768
- 1024x768
- 768x1024
- 390x844
- 375x667
- 320x568

Automated results at every exact viewport:

- Login and authenticated shell reported zero document-level horizontal overflow.
- Login panel remained within the document viewport and was vertically scrollable where the short mobile viewport required it.
- Login inputs and support links measured at least 44px; desktop login inputs measured 48px.
- Governed transparent logo source measured 128x128 natural pixels and rendered proportionately at 64px desktop/tablet and 54px mobile.
- Login school identity used one or two proportionate lines; it did not collapse into several narrow lines.
- Authenticated shell exposed exactly one visible academic-year selector.
- Desktop school identity remained one line.
- Mobile control order was exactly `menu`, `logo`, `year`, `bell`, `avatar`.
- Visible header, account-menu, and navigation controls measured at least 44px.
- Profile popover remained within every viewport.
- Both light and dark themes were observed after hydration at every viewport.
- Browser console warnings/errors: 0.
- Native dialogs: 0.

Drawer and keyboard result at 390x844:

- Drawer opened without clipping and focused `Close navigation menu`.
- Shift+Tab from the first control wrapped to the last `Pilot Acceptance` link.
- Tab from the last control wrapped to `Close navigation menu`.
- Escape closed the drawer and returned focus to `Open navigation menu`.
- Returned focus used a visible solid 2px outline.

Visual evidence:

- `login-desktop-dark-1440x900.png`
- `shell-super-admin-desktop-light-or-dark-1366x768.png`
- `shell-mobile-drawer-dark-390x844.png`

Isolation:

- Measurements used the ignored copied database only.
- Production runtime stderr remained 0 bytes through Batch 2.
- No credential, cookie, session token, password hash, internal user ID, or permission token is recorded here.

Next restart-safe batch: Change Password, login/rate-limit/error states, module smoke regression, and cache/service-worker boundaries.
