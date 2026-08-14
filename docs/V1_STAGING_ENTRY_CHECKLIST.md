# V1 Staging Entry Checklist

All items are fail-closed. Completing this document does not deploy staging.

- [ ] Explicit Stage-1A authorization, budget and hosting decision
- [ ] Private HTTPS origin and DNS plan approved
- [ ] Fresh synthetic staging database below an isolated data root
- [ ] No operational DB hash/path or real school data present
- [ ] One application instance for SQLite
- [ ] Environment validator passes; secrets supplied outside Git
- [ ] qpdf path and independently pinned SHA-256 configured if payslip delivery is enabled
- [ ] Durable versioned backup keys and tested restore operator available
- [ ] Live communication/payment/cloud providers remain disabled unless separately approved
- [ ] Candidate artifact checksum, migration plan, maintenance window and rollback owner recorded
- [ ] Independent V1 QA and main/tag release gates cleared
