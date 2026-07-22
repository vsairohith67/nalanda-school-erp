# Codex Prompt Strategy

Audit phase: Prompt 14A

## What Worked So Far

Feature-by-feature prompting was useful for safety. It helped keep fees, permissions, parents, attendance, leave, substitutes, timetable, imports, backup/restore, and operator docs from being mixed into one risky change.

The next phase should be shorter and sharper because the ERP now has many modules. Broad prompts cost tokens and increase the chance of accidental scope creep.

## Prompt Template for Future Work

Every future prompt should include:

- **Scope:** exact module, routes, files, or workflow.
- **Non-goals:** what must not be built.
- **Acceptance checks:** user-visible behavior that proves the work is done.
- **Tests:** targeted tests first, then full checks.
- **Browser QA:** roles, routes, desktop/mobile viewports, dark/light mode when UI is changed.
- **Cleanup:** remove temporary QA data or browser-local state.
- **Verification commands:** exact `pnpm.cmd` commands.
- **Backup rule:** run `pnpm.cmd backup` when durable data, backup/restore, or release readiness is touched.

## Bug Triage Rule

- Critical bugs are fixed immediately.
- Workflow correctness bugs are fixed before building dependent features.
- UI bugs are grouped into the UI/UX sprint unless they block safe operation.
- Future enhancements stay in the gap map until specifically scoped.

## Stabilization Cadence

After every 3 to 5 feature modules, run a stabilization sprint:

1. Route inventory refresh.
2. Permission/direct-route audit.
3. Mobile and responsive QA.
4. Documentation refresh.
5. Backup/restore verification.
6. Operator workflow check.

Prompt 14A starts such a stabilization sprint after Prompt 13E-QA.

## Recommended Near-Term Prompt Order

1. **Prompt 14B - App Shell, Navigation, Responsive Layout, and Design System Implementation**
2. **Prompt 14C - Dashboard Redesign and Operations Summary Cards**
3. **Prompt 14D - Mobile Route QA and UI Polish**
4. Resume feature modules only after the app shell and mobile experience are stable.

## Token-Saving Practices

- Reference the route inventory instead of rediscovering all routes.
- Reference the feature/gap map instead of relisting all future modules.
- Use `pnpm.cmd routes:list` to refresh route counts.
- Keep future prompts one module or one UI layer at a time.
- Put exact wording requirements in the prompt only when operator-facing text must be preserved.
- Avoid asking for broad redesign and new ERP modules in the same prompt.
