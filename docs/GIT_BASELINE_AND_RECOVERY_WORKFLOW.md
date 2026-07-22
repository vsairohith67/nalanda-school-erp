# Private Git Baseline and Recovery Workflow

## Repository contract

The only authorised repository for this baseline is the private GitHub repository `vsairohith67/nalanda-school-erp`, with HTTPS remote `https://github.com/vsairohith67/nalanda-school-erp.git`. It must remain private. Changing visibility, deploying, changing DNS, or pushing this tree to another owner/repository requires separate explicit approval.

The trusted initial commit message is `chore: establish verified Nalanda ERP baseline`. The stable annotated tag is `baseline-sec1-management-2026-07-22`. The tag identifies the source baseline after SEC-1 and Management reconciliation; operational data is deliberately outside Git.

## Git installation

Use official Git for Windows only. DEVOPS-1A installed `Git.Git` through Winget:

```powershell
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
git --version
```

If a terminal was already open during installation, close/reopen it so the updated `PATH` is loaded. Do not download an installer from an unrelated site.

## Ignore and tracked-file policy

`.gitignore` excludes every `.env` variant except the placeholder-only `.env.example`, dependencies, Next/build/test caches, SQLite and sidecar files, backups, private storage/uploads/OCR roots, cloud-backup/provider objects, pilot/rehearsal data, QA temporary roots, logs, generated exports/screenshots, Schoolknot export artifacts, and local IDE/agent state. Public registered assets, source, Prisma schema and migrations, tests, safe docs, `.env.example`, and `pnpm-lock.yaml` remain eligible for tracking.

`.gitattributes` normalises text line endings while marking images, fonts, archives, office documents, PDFs, and database formats as binary. Never use Git as a database/backup/upload store.

## Safety scanner

Run the dependency-free Node/TypeScript scanner before staging, after staging, before every commit, and before every push:

```powershell
pnpm.cmd git:safety-check
git add <explicit-safe-files>
pnpm.cmd git:safety-check
git diff --cached --name-only
```

The scanner examines candidate, staged, and tracked files. Failures print only a relative path and reason code; detected values are never printed. It rejects secret-shaped credentials, private keys, credential-bearing database URLs, realistic non-test secret assignments, non-placeholder `.env.example` values, databases, backups, private runtime storage, provider artifacts, QA/log/build output, and Schoolknot export artifacts. Synthetic tests and policy wording are allowed only when they do not contain a live high-confidence credential shape.

## Branch and review policy

- `main` is the stable branch. Do not force-push it.
- Use `agent/<short-description>` or another approved feature branch for later work.
- Run the safety scanner and relevant verification ladder before pushing.
- Review the staged name list and diff before every commit.
- Open a pull request for future feature/fix branches; require human review for schema, auth, finance, privacy, provider, backup/restore, or deployment changes.
- Do not rewrite published history without a documented recovery plan, verified clone/backup, stakeholder coordination, and explicit approval.

## Database, backup, and private-file recovery

Git restores source only. The operational SQLite database, JSON backups, encrypted provider objects, OCR images/crops, uploads, logs, exports, and business records are not in the repository. Recover them only from the separately controlled local/off-device backup workflow after verifying version, hash, custody, and restore scope. Never copy an operational database into a branch to make a test pass.

For source recovery, clone the private repository, verify `origin`, check out `main` or the signed-off tag, install from `pnpm-lock.yaml`, create a new local `.env` from `.env.example`, and restore operational data through the documented recovery process. The current migration chain still has the known clean-install baseline limitation; DEVOPS-1A does not repair or conceal it.

## Accidental-secret procedure

If a secret is staged but not committed, unstage it, remove it from the file, rotate it if exposure is uncertain, and rerun the scanner. If it is committed locally but not pushed, stop; rotate/revoke first, preserve a recovery reference, then recreate the local commit under an approved recovery plan. If it was pushed, treat it as compromised immediately: revoke/rotate it at the provider, disable affected sessions/webhooks, record the incident, inspect access/audit logs, notify the responsible owner, and plan coordinated history cleaning. Removing a later commit is not sufficient because the value remains in history.

Never paste credentials into chat, issues, pull requests, commit messages, shell history, or project files. Never force-push `main` as an improvised secret-removal step.

## Next phase

After DEVOPS-1A and independent DEVOPS-1A-QA are fully cleared, the next authorised DevOps phase is DEVOPS-1B clean-install migration-chain repair. That phase must work from a separate safe copy/branch, must not mutate the operational database, and requires its own exact verification and recovery plan.

