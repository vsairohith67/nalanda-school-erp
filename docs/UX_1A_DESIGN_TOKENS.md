# UX-1A Design Tokens

The shared system is defined in `app/globals.css`. Components must consume
tokens instead of creating page-local copies of the same spacing, radius,
shadow, or brand colour.

## Brand palette

| Token | Light value | Purpose |
|---|---:|---|
| `--sidebar` | `#10213e` | Logo-derived institutional navy |
| `--accent` | `#0f766e` | Teal actions, focus, active context |
| `--accent-hover` | `#0b5f59` | Teal interaction state |
| `--accent-2` | `#d97706` | Gold warning and selective emphasis |
| `--text` | `#12213f` | Primary readable text |
| `--muted` | `#64748b` | Secondary text |
| `--danger` | `#b42318` | Error/destructive state |
| `--success` | `#15803d` | Confirmed positive state |

Dark theme uses the existing `.dark` token set with brighter teal, gold,
danger, success, text, and border values. Components must not hard-code light
surface colours except the official logo’s neutral presentation tile.

## Typography

- UI: `--font-ui` = Inter, system UI, Segoe UI, sans-serif fallbacks.
- School name only: Georgia Bold, Times New Roman, serif fallback.
- UI hierarchy uses weight, size, spacing, and semantic headings; all-caps is
  reserved for small kickers and grouped-navigation labels.

## Spacing, radius, and elevation

- Spacing: `--space-1` through `--space-6` = 4, 8, 12, 16, 20, 24 px.
- Radius: `--radius-sm` 8 px, `--radius-md` 12 px,
  `--radius-lg` 20 px.
- Default elevation: `--shadow`.
- Login/popover elevation: `--shadow-raised`.

## Control rules

- Mobile actions: minimum 44 × 44 px.
- Sign-in fields and primary button: minimum 48 px on desktop and at least
  44 px on constrained mobile.
- Visible keyboard focus: 2 px `--accent` outline with 2 px offset.
- Inputs use token surfaces, text, border, and consistent 10–11 px radii.
- Status is expressed by text/icon as well as colour.

## Motion

Only short drawer, chevron, and spinner motion is used. Under
`prefers-reduced-motion: reduce`, shell/login animation and transition
durations collapse to `.01ms`, iteration count becomes one, and smooth
scrolling is removed.

## Component ownership

- `components/app-shell.tsx`: shell brand, header, year control, responsive
  drawer.
- `components/user-menu.tsx`: human identity, account actions, appearance.
- `components/login-form.tsx`: sign-in interaction and safe feedback.
- `lib/role-presentation.ts`: central human labels and dashboard titles.

Do not derive a human role by formatting the raw enum in a page. Add an
explicit label to `lib/role-presentation.ts`.
