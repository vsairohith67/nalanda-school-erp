# DATA-0B Controlled Sample-Data Cleanup and New Operational Baseline

**Execution date:** 28 July 2026
**Feature branch:** `data/controlled-sample-cleanup`
**DATA-0A-QA prerequisite:** `SAMPLE_DATA_PROVENANCE_CLEARED`
**Approval captured:** exact required phrase, before operational mutation
**Receipt policy:** `PRESERVE_RECEIPT_SEQUENCE`
**DATA-0B result:** `CONTROLLED_SAMPLE_DATA_CLEANUP_READY_FOR_QA`

## Scope and deletion proof

Only the DATA-0A-QA verified dependency manifest was deleted. No table was
dropped, no schema or migration was changed, and no blanket reset was used.

| Table | Deleted | Provenance |
|---|---:|---|
| `PaymentAudit` | 19 | `VERIFIED_SAMPLE` or `VERIFIED_QA` |
| `ReceiptNote` | 1 | `VERIFIED_SAMPLE` |
| `Payment` | 19 | 11 `VERIFIED_SAMPLE`; 8 `VERIFIED_QA` |
| `StudentLifecycleEvent` | 8 | `VERIFIED_SAMPLE` |
| `AcademicYearEnrollment` | 8 | `VERIFIED_SAMPLE` |
| `Student` | 8 | `VERIFIED_SAMPLE` |

The controlled transaction checked the exact expected count before each delete,
changed only those six tables, returned zero foreign-key violations and created
the privacy-safe event `DATA0B-CLEANUP-20260728T070201Z`. Zero
`POTENTIALLY_REAL` or `UNKNOWN` record was in the approved closure, so none was
deleted.

## Database identities and protected rollback

| Evidence | Value |
|---|---|
| Approved pre-clean SHA-256 | `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392` |
| Pre-clean bytes | 4,771,840 |
| Immediate post-transaction SHA-256 | `38D9BF773EF4DBA1141AFD4FD1727C876F323CF88CECB392DDED9DBC71B9E7C9` |
| Final post-QA SHA-256 | `EBBADEC788164CD7F80DF44BB96F18C854963AE44F2F2BDF8037F23C24C199D6` |
| Final bytes | 4,771,840 |
| Final timestamp (UTC) | `2026-07-28T07:14:01.4109604Z` |

The immediate and final post-clean hashes differ because authorized Browser
login/restart QA recorded normal user login/audit activity. The six business
tables remained empty throughout both restarts.

Protected ignored artifacts:

- logical pre-clean v37 backup:
  `.data0a/data0b/pre-clean/DATA0B-PRECLEAN-20260728T070134Z/DATA0B-PRECLEAN-20260728T070134Z-v37.json`,
  SHA-256
  `6937BFF42F0E1FE8CAABCF56D784E28CD7DD76846FBDD91EF3F4497D8F98ED42`;
- byte-identical pre-clean rollback database in the same protected directory,
  SHA-256 equal to the approved pre-clean database hash;
- encrypted raw rollback:
  `.data0a/backups/DATA0A-preflight-20260728T070201Z-database.npsbackup`,
  SHA-256
  `0C004E219A5B9A94E61E88B7C953D3C41C0A4C94F9CAC3CB23FAEBC5F6B05741`,
  with its separately ignored key;
- first post-clean logical v37 backup:
  `.data0a/data0b/post-clean/DATA0B-POSTCLEAN-20260728T071040Z/DATA0B-POSTCLEAN-20260728T071040Z-v37.json`,
  SHA-256
  `C8FE671F184EFF03F19887ACA1E81CC233784FE8EDEE73C242B90B8BF3B27241`;
- byte-identical post-clean rollback copy in the same protected directory,
  SHA-256
  `38D9BF773EF4DBA1141AFD4FD1727C876F323CF88CECB392DDED9DBC71B9E7C9`;
- final standard version-37 backup:
  `backups/nalanda-fee-control-backup-2026-07-28-13-04.json`, SHA-256
  `EA131902BDDE14FD5B878B33C12484C6ED767D6B645CDDD056617AF3D56FE627`.

Both v37 backups parsed without sensitive keys. The pre-clean raw copy opened
with SQLite integrity `ok`. The post-clean backup restored twice into a blank
migrated database without reintroducing business data. Database, backup, key
and report paths are ignored and untracked.

### Rollback procedure

1. Stop every ERP Node process and confirm the application ports are closed.
2. Preserve the current post-clean database separately; do not overwrite the
   only post-clean evidence.
3. Verify the selected pre-clean raw copy has SHA-256
   `1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392`.
4. Replace `prisma/dev.db` only with that verified raw copy, or decrypt the
   protected encrypted raw artifact with its separately stored key.
5. Open the restored database, run SQLite integrity and foreign-key checks, and
   verify the historical 8 / 8 / 19 / ₹99,100 baseline before restarting.
6. Record the rollback event. Do not run any demo seed.

## New official operational baseline

| Business measure | New baseline |
|---|---:|
| Students | 0 |
| Active enrollments | 0 |
| Payments | 0 |
| Collected | ₹0 |
| Guardians | 0 |
| Staff | 0 |
| Payment audits / receipt notes / lifecycle residue | 0 / 0 / 0 |
| Sample or QA markers | 0 |
| Foreign-key violations | 0 |

The former 8 Students / 8 active enrollments / 19 Payments / ₹99,100 collected
baseline is historical rollback/provenance evidence only. It is not the current
operational baseline.

## Intentional configuration retained

| Configuration | Rows |
|---|---:|
| `SchoolSettings` | 1 |
| `RolePermission` | 2,696 |
| `FeeStructure` | 13 |
| `ExpenseCategory` / `ExpenseDepartment` | 15 / 8 |
| `MiscIncomeItem` | 8 |
| `TimetableClassSection` / `TimetablePeriodTemplate` | 23 / 249 |
| AI evaluation cases / profiles / source policies | 9 / 3 / 22 |
| OCR profiles / SMS-email profiles | 4 / 2 |
| Authorized users | 4 |

Roles, permissions, school and fee settings, templates, academic masters,
provider configuration, backup configuration, system masters and migration
state were retained. Receipt numbers were not reset or reused.

## Accounts and mandatory AUTH-2A follow-up

The four enabled role identities (`SUPER_ADMIN`, `ADMIN`, `ACCOUNTANT`,
`VIEWER`) were preserved because deleting or replacing them without a supplied
named owner and verified replacement credentials could lock out the school.
There is one enabled identity per role and no duplicate active role identity.
System Health correctly reports the documented-password risk.

`AUTH-2A` must classify a named human owner for every retained account, rotate
every known default password, verify the role and enabled/disabled decision,
record the rotation requirement and test recovery access before real data or
deployment. DATA-0B did not weaken, replace or expose credentials.

## Seed prevention

Business demo seeding now fails closed:

- ordinary startup and production bootstrap do not create Students or Payments;
- demo business seeding requires exact
  `ALLOW_DEMO_BUSINESS_DATA=true`;
- the operational `prisma/dev.db` is refused by resolved path, real path and
  file identity;
- a separate existing database under an explicit isolated copied/test root is
  required;
- staging and production/release validation reject the demo flag;
- permanent system/master seeding remains available within its existing
  controlled boundary;
- seed output contains no secret.

## Validation and Browser QA

- lifecycle backfill scanned zero Students and made no change;
- 274 page routes and 378 API routes were inventoried;
- typecheck passed;
- all 1,535 tests across 167 files passed;
- the bounded 4 GB production build generated all 212 entries;
- the final version-37 backup contains zero business rows, retains the
  intentional settings and masters, and contains zero sensitive-key fields;
- Git safety and `git diff --check` passed;
- production Browser QA passed at 1366×768 and exact 390×844;
- exact mobile proof was
  `innerWidth=390`, `innerHeight=844`, `clientWidth=390`,
  `clientHeight=844`, with no horizontal overflow;
- light and dark modes passed;
- Dashboard, Students, Add Payment, Pending Dues, Daily Collection, reports,
  Receipt Audit, Library and membership views showed safe empty states;
- Parent and Teacher routes denied the unrelated Super Admin session without
  leaking portal data;
- System Health showed no sample-data warning;
- Browser console warnings/errors and production stderr were zero;
- two production restarts retained the zero baseline and created no sample
  rows.

## Next gate

DATA-0B-QA must independently verify this evidence on the retained feature
branch. The branch must not merge and the clean-baseline tag must not be
created until that independent gate clears.
