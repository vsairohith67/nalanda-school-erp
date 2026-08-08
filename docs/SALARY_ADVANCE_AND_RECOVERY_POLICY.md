# Salary Advance and Recovery Policy

A linked Staff member may request an advance, or an authorised payroll operator may record the request. The request contains only Staff link, amount and reason. This module never creates the advance disbursement.

Authorised leadership may approve or reject a requested advance. Approval requires re-authentication, an amount no greater than requested, a reason, and a recovery schedule whose rows exactly equal the approved amount. Each row references a governed payroll period. The schedule is versioned; revisions cancel unrecovered rows and append replacements.

Payroll calculation reads only `SCHEDULED` rows for the exact Staff member and period. Locking the run changes a row to recovered and reduces the balance in the same transaction. Compare-and-set guards the schedule and balance. Negative balances, duplicate recovery, recovery above the remaining balance and cancellation after recovery are refused.

A governed payroll reversal changes recovered schedules to reversed and restores the balance transactionally. Requests, approvals, rejections, cancellations, revisions, recoveries and reversals remain in append-only history. No bank transfer, Payment, receipt, expense or cash movement is created.
