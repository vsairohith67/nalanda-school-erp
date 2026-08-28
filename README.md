# Nalanda School Management System

Nalanda School Management System is a secure school ERP and operations platform for student records, fee collection, dues, receipts, imports, backups, users, and timetable preparation. It is designed for governed use across web and installed school apps.

## Setup

1. Install Node.js LTS and pnpm:

```powershell
npm install --global pnpm
```

2. Open PowerShell in the repository root.
3. Install packages and create the environment file:

```powershell
pnpm.cmd install --frozen-lockfile
Copy-Item .env.example .env
pnpm.cmd exec prisma generate --schema prisma/schema.prisma
pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma
pnpm.cmd db:seed
```

4. Put a unique secret of at least 32 characters in `.env` as `AUTH_SECRET`.

## Run

```powershell
pnpm dev
```

Open `http://localhost:3000`. On a new database, complete the first Director setup. Windows users may instead double-click `tools\start-dev.bat`.

## Backup

Director/Admin can use **Import / Export → Download Full Backup**, or run:

```powershell
pnpm backup
```

Copy important backup files from `backups` to a USB drive or another protected location.

## Emergency commands

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm backup
```

Windows helpers are available in `tools`: `run-checks.bat`, `build-app.bat`, and `backup-now.bat`.

Never import or restore real data without taking a fresh backup first. Test restore only on a copied database.

## Full documentation

Start with [docs/INDEX.md](docs/INDEX.md).

- Operator guide: [docs/NOOB_OPERATING_GUIDE.md](docs/NOOB_OPERATING_GUIDE.md)
- Project handover: [docs/PROJECT_HANDOVER.md](docs/PROJECT_HANDOVER.md)
- Developer continuation: [docs/DEVELOPER_CONTINUATION_GUIDE.md](docs/DEVELOPER_CONTINUATION_GUIDE.md)
- Real-data pilot: [docs/REAL_DATA_PILOT_PLAN.md](docs/REAL_DATA_PILOT_PLAN.md)
- Routine operations: [docs/OPERATIONS.md](docs/OPERATIONS.md)
