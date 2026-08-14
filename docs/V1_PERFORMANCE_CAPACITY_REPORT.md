# V1 Performance and Capacity Report

The exact copied-database V1 profile completed with 800 Students, 1,200 Guardians, 80 Staff, 45 Teachers, Classes I-X with Sections A-D across two academic years, three sibling-family groups of 2/3/4 children, 1,600 enrollments and 4,480 completed lineage rows. Execution, idempotent replay and exact rollback passed; measured execute-through-rollback evidence completed in 8,032 ms on the local QA host.

The repository currently inventories 333 pages and 547 APIs. Release packaging, backup/restore, migration deployment and full regression remain serialized and bounded. SQLite remains restricted to one application instance; multi-instance or internet-facing capacity requires a separate architecture and staging decision.

No response-time service-level objective is inferred from local fixture execution. Browser and build timing evidence is acceptance evidence for this machine, not a production sizing promise.
