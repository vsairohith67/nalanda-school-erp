# Payroll Calculation Specification

All monetary values are stored and calculated as whole paise. Rounding is explicit per component: nearest paise, nearest rupee, floor rupee or ceiling rupee. No floating currency is persisted.

The governed calculation order is component display order. Fixed components use their approved paise value. Percentage components use an explicitly named earlier component and basis points. Manual components require an adjustment reason and approval reference. Calculated components execute only one of the allowlisted rules: approved unpaid-leave deduction, approved attendance-linked half-day deduction, or advance recovery.

For a period of `P` calendar days, `period units = 2P`. Payroll eligibility is the intersection of the period, Staff joining date, compensation assignment and payroll-eligibility dates. A prorated fixed component is `fixed paise × eligible units / period units`. Approved unpaid leave uses half-day units and only an explicit calculated deduction component. Half-day attendance has no salary effect unless the linked approved policy says `HALF_DAY_AS_0_5`.

Gross is the sum of earnings. Net is `gross + reimbursements - deductions`; negative net is refused. Arrears, reimbursements and other adjustments are zero unless a matching approved manual component and bounded approval evidence exist. Recovery cannot exceed an advance’s remaining balance.

Calculation stops when any required Staff attendance session is missing or unlocked, any eligible Staff row is missing, compensation overlaps, policy/rule/component versions are unavailable, a percentage base is absent, a statutory-looking rule is executable, or an advance schedule is stale. Formula previews show paise arithmetic and source-version references.

The engine never reads Student marks, rankings or teacher-performance analytics. Names resembling EPF, PF, ESI, UAN, TDS, pension or professional tax are accepted only as `MANUAL` plus `MANUAL_OR_EXTERNALLY_APPROVED`; no statutory formula is embedded.
