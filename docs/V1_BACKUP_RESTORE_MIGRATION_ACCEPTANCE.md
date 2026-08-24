# V1 Backup, Restore and Migration Acceptance

- 22 ordered active Prisma migrations are current; names are unique and the fresh-install graph is validated independently.
- Fresh and copied-database deployment runs are idempotent.
- Backup format version 43 covers 269 current-main durable collections; restore accepts versions 1 through 43 and rejects later versions.
- Governed module asset recovery uses encrypted manifests, exact entry equality, hash verification and two isolated restores.
- Operational SQLite is never a migration rehearsal or restore target.
- The protected operational file remained byte-identical before and after all copied/synthetic database rehearsals; its private path and digest are intentionally omitted from repository evidence.
- Support recovery status now requires a durable configured key; OCR evidence verifies its stored hash on every served read.
- Historical Release Operations evidence reconfirmed the then-current 18 migrations and backup v41 contract, 292 copied-database tables, byte-identical pre-deploy evidence, logical restore twice, a verified 10,953-file artifact payload, one-release locking, injected low-space refusal, zero provider calls and no private data in the artifact. That count is `HISTORICAL_ONLY`; use the current 22/v43 statement above.
- Independent `V1FINALQA` recreated both source and restore databases from all migrations, supplied a synthetic local restore actor only when the fresh target had none, proved schema equivalence, restored twice, replayed exactly and rolled the scale dataset back to its original empty-business state.

Production restore, real retention purge and external key custody require named operators and separate authorization.
