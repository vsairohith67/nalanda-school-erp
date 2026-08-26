# POSTGRES-READINESS-1A security remediation

Authoritative source scan: `f204019f-716f-4663-bfd6-c281fdb19ef1`

Original result: two High, three Medium

Post-fix read-only verification: five fixed, zero still vulnerable, zero inconclusive

```json
{
  "results": [
    {
      "id": "hardcoded-privileged-test-account",
      "status": "fixed",
      "evidence": "The restore entrypoint now calls the synthetic-local guard before database access, and the structural DIRECTOR is inactive with mustChangePassword plus a fresh random password hash. Synthetic export and restore-twice preserve 8 Students, 11 Payments, and the exact 92100 total."
    },
    {
      "id": "postgres-qa-target-isolation",
      "status": "fixed",
      "evidence": "Restore, roles, performance, and concurrency all call one guard requiring explicit opt-in, non-production context, loopback PostgreSQL, and a qa/ci/synthetic/test database name. Unit tests prove missing opt-in, remote host, production context, and unmarked name are rejected."
    },
    {
      "id": "postgres-tls-fail-closed",
      "status": "fixed",
      "evidence": "Application startup and provider CLI both reject staging/production PostgreSQL URLs without certificate-validating sslmode plus sslaccept=strict, bounded pool/connect parameters, and distinct runtime/migrator usernames. Focused tests cover missing TLS, invalid-certificate acceptance, valid TLS, and shared identity rejection."
    },
    {
      "id": "runtime-migration-ledger-isolation",
      "status": "fixed",
      "evidence": "The role contract explicitly revokes INSERT, UPDATE, and DELETE on public._prisma_migrations from nalanda_runtime. All three DML probes and the existing schema/table/role probes are denied while application-table CRUD remains allowed."
    },
    {
      "id": "logical-transfer-confidentiality",
      "status": "fixed",
      "evidence": "The readiness exporter accepts only an explicit synthetic SQLite database below worktree tmp and creates transfer, manifest, and restore evidence exclusively with owner-only mode. Existing files, symlinks, and linked parent paths are refused; operational migration remains out of scope."
    }
  ]
}
```

The original scan was repository-inventoried but intentionally partial outside the PostgreSQL readiness surfaces and security-sensitive sink searches. Managed-provider TLS termination, network ACLs, PITR, login-role provisioning, deployed secrets, deployment, and operational-data migration were not available and are not claimed active.
