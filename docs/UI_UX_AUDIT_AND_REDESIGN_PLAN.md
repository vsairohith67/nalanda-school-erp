# UI/UX Audit and Redesign Plan

Audit phase: Prompt 14A  
Implementation phase: **Prompt 14C - Dashboard Redesign and Premium Summary Cards**

This is a planning document only. It does not claim Schoolknot screenshots prove production quality; those screenshots should be used only as inspiration for clearer dashboards, stronger cards, and a more app-like mobile experience.

## Current UI/UX Findings

### Mobile Navigation Problems

- On screens under 980px, the sidebar becomes a normal full-width block above the page content.
- The nav becomes a two-column grid, which still consumes a large amount of vertical space for Director/Admin/Super Admin roles.
- A high-permission user may see dashboard, student, guardian, staff, attendance, leave, substitute, notices, payments, reports, timetable, settings, users, roles, import, and pilot links before the actual page content.
- The current desktop hide/unhide button is in the topbar, but it does not solve mobile navigation because the sidebar is still rendered above content.
- Timetable, attendance, leave, and substitute pages add subnav rows after the main nav, increasing stacked navigation on phones.

### Sidebar Problems

- Sidebar links are flat; related module destinations are not grouped.
- Report links and entry links are both top-level, creating clutter.
- The active state works, but nested routes such as edit/detail pages do not clearly highlight a parent module unless the route is an exact match.
- The app version and health hints are useful but add to vertical density.

### Top Header Problems

- Header contains school name, academic year select, sidebar toggle, theme toggle, and user menu.
- On mobile, top actions wrap and can become tall before content.
- The academic-year select is currently a one-option control, which looks interactive but does not change state.
- The topbar does not yet provide a compact page-context title or primary mobile menu button.

### Vertical Space Before Content

- Mobile users see sidebar brand, product, academic year, many nav links, app version, topbar, warning banners, pilot banners, and only then page content.
- This is the biggest mobile responsiveness issue found in Prompt 14A.

### Table Overflow Patterns

- Tables are commonly wrapped and scroll horizontally, which protects layout but can feel spreadsheet-like on phones.
- Role matrix, payments, pending dues, attendance rosters, staff attendance, timetable assignments, and substitute planner are the highest-risk tables.
- Sticky table headers help desktop scanning but do not solve phone readability.
- Some tables need mobile card rows or a priority-column design later.

### Cards and Layout Consistency

- Shared card, stat, badge, form-grid, filters, and table-wrap patterns exist.
- Newer modules use a mix of custom stacks and compact CSS blocks, so spacing and action placement vary.
- Some route pages feel operational and safe, but not premium or modern enough for leadership demos.
- Card radius and padding are not fully consistent across notices, dashboard, health, reports, and timetable panels.

### Button Styling Consistency

- Primary and secondary buttons exist, but different pages mix links, buttons, table links, and action panels.
- Some critical workflow buttons are full-width on mobile; others remain inside dense table/action areas.
- Icons are used in the shell, but not consistently inside page-level buttons.

### Form Layout Consistency

- Forms use grids/flex patterns, but long forms such as Add Student, Add Payment, Import/Export, Settings, Roles, Timetable Builder, and attendance screens need clearer grouping.
- Filter panels often take vertical space and should become collapsible or compact on mobile.
- The app needs a standard form footer/action bar pattern.

### Empty States

- Empty states exist in several tables, but style and wording are inconsistent.
- Future standard: empty state should name what is missing and the safest next action, without looking like an error.

### Filter Panels

- Filters often sit in cards or flex rows and wrap on smaller screens.
- On report-heavy routes, filters should be compact, collapsible on mobile, and paired with a visible active-filter summary.

### Reports Pages

- Reports work but are table-first.
- Report pages need summary cards before detailed tables, clearer export actions, and consistent date-range controls.

### Dashboard Weakness

- Current dashboard is useful but fee-core focused.
- It lacks modern cross-module operational cards and visual hierarchy for leadership.
- It should eventually show attendance, leave, substitutes, notices, warnings, backup status, and system health alongside finance.

### Dark/Light Mode Issues

- Theme tokens exist, and dark/light mode works broadly.
- Future QA should verify contrast for badges, warning banners, table headers, disabled controls, and print routes.
- Print views must remain white-background and ink-safe regardless of app theme.

### Role-Based Menu Clutter

- Permission filtering is correct, but too many permitted routes appear as separate top-level items.
- Director/Admin/Super Admin users need grouped modules.
- Teacher and Parent shells are simpler and should stay minimal.

## Schoolknot-Inspired Direction

Use Schoolknot-style screenshots as inspiration for:

- summary cards with clear current numbers,
- clean dashboard groups,
- chart cards for collection/dues trends,
- budget/finance visuals after expenses/cash book exist,
- softer modern cards with restrained shadows,
- app-like mobile navigation,
- compact report summaries before tables.

Do not copy Schoolknot UI blindly. Nalanda's ERP has stronger safety needs: audit trails, preview-first import, role isolation, and reversible workflows must remain visually obvious.

## Design System Plan for Prompt 14B

### App Shell Layout

- Desktop: keep a left navigation shell, but move toward grouped module sections.
- Content: use a consistent max-width for normal pages and allow full-width only for complex grids/tables.
- Warnings: keep production/pilot banners visible but compact.

### Desktop Sidebar Behavior

- Preserve hide/unhide behavior.
- Add better collapsed state semantics: icon-only or fully hidden should be deliberate and keyboard accessible.
- Group links by module: Core, Finance, Attendance, Staff, Timetable, Admin/System.
- Highlight parent section for detail routes.

### Mobile Navigation Behavior

- Replace the full-height mobile sidebar block with a drawer or compact mobile menu.
- Page content should appear immediately after the topbar/banners.
- Keep Parent and Teacher mobile navigation minimal.
- Use a clear menu button in the topbar with a drawer that can be closed by route change, Escape, or backdrop.

### Hide/Unhide Sidebar Behavior

- Desktop hide/unhide should persist during the browser session if easy.
- Mobile drawer open/close should not alter desktop collapsed preference.
- Button labels should remain accessible: "Open navigation", "Close navigation", "Hide sidebar", "Show sidebar".

### Top Bar

- Keep school identity.
- Make the topbar compact on mobile.
- Reassess the academic-year select until multiple academic years are supported.
- Keep theme and user menu available without wrapping into excessive height.

### Cards

- Define standard card padding, radius, border, heading, supporting text, and action placement.
- Use repeated cards for summary metrics, dashboard widgets, empty states, and report summaries.
- Avoid nesting cards inside cards.

### Tables

- Standardize table wrappers, sticky headers, numeric alignment, row actions, and empty rows.
- For high-risk mobile tables, plan either priority columns or stacked row cards in later route-specific prompts.

### Forms

- Define form section headings, grid spacing, help text, error text, and footer actions.
- Keep dangerous/destructive actions visually separated.
- Preserve confirmation text for restore and destructive workflows.

### Buttons

- Standardize primary, secondary, danger, ghost/icon button styles.
- Use icons for common actions when helpful, with accessible labels and titles.
- Keep action labels beginner-friendly for school operators.

### Status Badges

- Define success, warning, danger, neutral, draft, submitted, locked, approved, rejected, cancelled, and completed badge tokens.
- Ensure contrast in light and dark themes.

### Filters

- Standardize report filters with compact mobile collapse, active-filter summary, reset link, and export action placement.

### Report Summary Cards

- Put the key numbers above report tables.
- Examples: total collection, cash, UPI, absent count, late count, pending leave, unassigned substitute duties.

### Empty States

- Standard empty states should include:
  - plain reason,
  - safe next action,
  - no alarm styling unless data is truly risky.

### Print Views

- Keep print views minimal, white-background, and no app navigation.
- Do not apply dashboard/card redesign styles to print documents unless print-tested.

### Dark/Light Token Plan

- Keep theme tokens centralized in `app/globals.css`.
- Add semantic tokens for shell, card, table, badge, warning, success, danger, info, input, and focus.
- Verify badge and table contrast in both themes.

### Responsive Breakpoints

- Suggested breakpoints:
  - `<= 700px`: phone layout, drawer nav, single-column forms, compact filters.
  - `701px-980px`: tablet layout, drawer or compact rail, two-column where safe.
  - `> 980px`: desktop sidebar and full table layouts.

## Prompt 14C dashboard implementation

Prompt 14C replaces the fee-only home page with a permission-aware school command center using existing records only.

Implemented sections:

- welcome/status header with school, academic year, signed-in role, current date, and system-health summary when permitted;
- Today at a glance with collection, dues, student/guardian/staff counts, student/staff attendance, pending leave, substitute coverage, and active notice totals when the user can access those datasets;
- permission-derived quick actions for payments, students, attendance, leave, substitutes, notices, import/export, and backup;
- finance snapshot with today/month collection, pending dues, recent receipts, and existing payment-mode totals;
- attendance and staff-operations snapshot with explicit no-session states;
- recent activity and alerts filtered server-side so restricted roles do not receive finance, notice, leave, or import details;
- responsive desktop and two-column mobile metric/action layouts with light/dark theme tokens.

Role behavior:

- Super Admin, Director, and Admin receive the broad command-center view allowed by their effective permissions.
- Principal receives academic/operations summaries and only the finance readouts already allowed by the permission matrix.
- Accountant receives fee-focused metrics and actions without staff-management data.
- Parent and Teacher continue to their dedicated safe portal routes instead of the internal dashboard.
- Viewer / Auditor receives read-only permitted summaries and no quick-action buttons.

Remaining limitations:

- “No session recorded today” is shown when manual student or staff attendance has not been created; the dashboard does not estimate attendance.
- Backup status is limited to existing system-health readiness and the backup workspace; server-side last-backup history is not stored.
- No collection trend chart is shown because the prompt avoided introducing a chart library or unsupported analytics.
- Expenses/budget, exams, UDISE+, certificates, AI recommendations, biometric sync, messaging, gateways, website/app, and cloud metrics remain future ideas only after those modules exist.

### Prompt 14C-QA acceptance

Prompt 14C-QA verified the dashboard against live local records and fixed three bounded defects:

- today and month-to-date payment metrics now use the explicit `Asia/Kolkata` school calendar instead of UTC date keys;
- undated `PUBLISHED` notices now count as current, matching the existing parent-notice visibility rule;
- the legacy `/api/dashboard` response now uses the same effective-permission filtering as the page instead of returning the older broad fee payload.

The live midnight rollover from 30 June to 1 July was observed during QA: the dashboard date changed to 1 July, July collection remained zero, pending dues stayed `₹1,90,800` across seven students, and both attendance cards remained “Not marked yet” because no 1 July sessions existed. Desktop/mobile, light/dark, mobile drawer, focus visibility, Accountant scope, Parent/Teacher redirects, and Viewer read-only behavior passed.

Recommended next phase: a separately scoped route-specific UI polish pass for high-density forms/tables, starting with the most-used operator workflow. Do not combine that work with a new ERP module.
- Later Schoolknot-style finance/budget cards after budget/expense data exists.

Dashboard redesign should be Prompt 14C, after app shell/design-system foundations.

## Prompt 14B Implementation Notes

Prompt 14B implemented the shared app-shell foundation without adding new ERP modules or changing business rules.

### Shell and Navigation

- Desktop keeps the left sidebar and the existing hide/show button.
- Sidebar links are now grouped as Dashboard, Students & Parents, Fees & Reports, Attendance, Staff & Leave, Timetable, Communication, Administration, and System.
- Grouped navigation is still built from `lib/access-rules.ts` and effective permissions. The grouping layer does not bypass route or API permission checks.
- Mobile no longer renders the full sidebar above page content. The sidebar becomes an off-canvas drawer opened from the topbar.
- The mobile drawer closes from the close button, the backdrop, Escape, or after selecting a navigation link.
- Parent and Teacher shells stay minimal and keep their safe role-specific navigation.
- Viewer / Auditor still sees reports/read-only links only, not entry/action routes.

### Design-System Foundation

Prompt 14B standardized these reusable primitives:

- `PageShell`
- `PageHeader`
- `SectionCard`
- `StatCard`
- `StatusBadge`
- `EmptyState`
- `.page-shell`
- `.section-card`
- `.filter-panel`
- `.form-panel`
- `.page-tabs`
- `.responsive-grid`
- `.table-wrap`
- `.empty-state`
- shared focus, button, card, table, badge, warning, and mobile topbar behavior

The dashboard was lightly moved onto `PageShell` and `SectionCard` as a high-traffic example. Dashboard content and charts were not redesigned.

### Remaining UI Work for Prompt 14C+

- Dashboard redesign and cross-module leadership cards remain Prompt 14C.
- Route-specific mobile table/card-row designs remain future UI prompts.
- Collapsible filters and form footer/action bars are still foundation candidates for later page-level polish.
- Detail/edit routes may still need parent-section active highlighting; Prompt 14B preserved exact active highlighting.

## Recommended Next Prompt

**Route-specific UI polish after Prompt 14C-QA**

Scope:

- Redesign the dashboard using the new shell/design primitives.
- Add cross-module summary cards only from existing modules and data.
- Keep business logic, schema, backup format, and role permissions unchanged unless explicitly scoped.
- Do not add expenses, exams, certificates, website/app/PWA, WhatsApp/SMS/email, biometric sync, payment gateway, or AI assistant.

Prompt 14B acceptance checks:

- Director/Admin mobile content appears without scrolling through a full sidebar.
- Parent and Teacher shells remain minimal.
- Desktop sidebar can hide/show.
- Route permissions and direct blocked routes still work.
- Light/dark mode and print views remain safe.
- Run typecheck, tests, build, backup, and browser QA at desktop and mobile widths.

Prompt 14C acceptance checks:

- Dashboard uses existing stable ERP data.
- New cards remain permission-safe.
- Mobile dashboard does not create horizontal overflow.
- Preserve existing routes, permissions, role gates, and feature behavior.
