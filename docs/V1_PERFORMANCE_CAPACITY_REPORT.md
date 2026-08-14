# V1 Performance and Capacity Report

The independent fresh-migrated V1 profile completed with 800 Students, 1,200 Guardians, 80 Staff, 45 Teachers, Classes I-X with Sections A-D across two academic years, three sibling-family groups of 2/3/4 children, 1,600 enrollments and 4,480 completed lineage rows. Execution, idempotent replay and exact rollback passed; measured execute-through-rollback evidence completed in 8,055 ms on the local QA host.

The bounded database profile sampled 120 reads and 30 writes. Read p50/p95/p99/max were 0.79/0.94/1.02/1.26 ms; write p50/p95/p99/max were 4.13/4.72/5.41/5.41 ms; combined p50/p95/p99/max were 0.82/4.37/4.72/5.41 ms. Error rate and SQLite busy count were zero. CPU was 125 ms; RSS moved from 348,344,320 to 348,483,584 bytes and heap grew by 5,305,832 bytes without sustained growth.

The repository currently inventories 333 pages and 547 APIs. Release packaging, backup/restore, migration deployment and full regression remain serialized and bounded. SQLite remains restricted to one application instance; multi-instance or internet-facing capacity requires a separate architecture and staging decision.

The independent measurements clear the local acceptance budgets of p95 read <=2 s, p95 ordinary write <=3 s and p99 ordinary request <=5 s. No response-time service-level objective is inferred from local fixture execution. Browser and build timing evidence is acceptance evidence for this machine, not a production sizing promise.
