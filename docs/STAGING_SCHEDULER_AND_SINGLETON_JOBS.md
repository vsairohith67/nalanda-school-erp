# Staging Scheduler and Singleton Jobs

The Next.js server has no durable in-process scheduler. Periodic work is invoked through authenticated APIs or CLI scripts. Staging uses the OS/platform scheduler plus a single global file/advisory lock; it never starts a second app instance for SQLite jobs.

| Work | Trigger now | Schedule plan | Retry/idempotency/lock | Staging state |
| --- | --- | --- | --- | --- |
| JSON backup | `pnpm backup` / API | daily and before deploy | singleton; serialized; new versioned artifact; verify before success | enabled for synthetic DB only |
| Encrypted backup | cloud-backup CLI/routes/worker | manual initially; later scheduled | singleton; idempotency keys and verification; encryption key required | local-folder or MOCK only; external upload disabled |
| Backup verification/restore rehearsal | CLI/routes | weekly/manual | isolated copied DB; safe retry with new run; cleanup DB/WAL/SHM | synthetic/local only |
| Backup retention/temp cleanup | explicit CLI | daily preview, approved prune | singleton; allowlisted object/temp keys; retryable | preview/cleanup only; no external provider delete |
| In-app notification campaigns | UI/API | manual | DB workflow guards; idempotent actions | enabled in-app only |
| WhatsApp delivery | `whatsapp:process` / API | no schedule in DEVOPS-1C | singleton worker, delivery idempotency/retry rules | deterministic MOCK only; LIVE disabled |
| SMS/Email delivery | `sms-email:process` / API | no schedule in DEVOPS-1C | singleton worker, batch/delivery idempotency | deterministic MOCK only; LIVE disabled |
| OCR extraction/posting | UI/API | manual only | human review; posting fail-closed; no automatic Payment creation | manual/deterministic only |
| AI assistant | request-driven | no background schedule | rate/concurrency controls | deterministic MOCK only |
| Student lifecycle backfill | CLI dry-run by default | release verification only | idempotent design but no automatic staging mutation | dry-run only |
| Cleanup/test reset | explicit preview/apply CLI | no unattended schedule | strict markers, environment guard, preview; requires lock | isolated synthetic data only |
| Reconciliation/reminders | explicit reports/workflows | manual until separately approved | must declare idempotency and owner before scheduling | disabled/unattended false |
| Health probes | ingress/external GET | 1 minute liveness; 5 minute deep safe read later | safe retry, no writes, no singleton DB mutation | liveness enabled locally; external monitor pending |

## Scheduler controls

- Every scheduled command loads the same staging environment contract, then acquires `/run/nalanda/scheduler.lock` or a narrower mutually exclusive lock before opening SQLite.
- `Persistent=true` catch-up is disabled for messaging and any job that could send externally. Backup catch-up may run once after restart if no deploy/restore is active.
- Set explicit timeouts, maximum retries with exponential backoff/jitter, and a dead-letter/failed DB status. Never infinite-loop.
- Record job ID, safe status/counts, start/end/duration, release and next action. Do not log payloads/recipients/records.
- Deploy/restore has priority. Maintenance prevents new workers and waits for running jobs or aborts safely.
- At startup, assert all LIVE provider gates false. Any unexpected LIVE profile/credential/flag pages the operator and skips work.
