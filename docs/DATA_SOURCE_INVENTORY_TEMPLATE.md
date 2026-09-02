# Data Source Inventory Template

Use the empty [CSV template](../templates/onboarding/source-inventory.csv) or the [JSON schema](../config/onboarding/source-inventory.schema.json). Do not paste source values into Git, trackers or public CI.

Create one entry for each possible Schoolknot export, workbook, Google Sheet/CSV, fee/accounting register, attendance export, report archive, Staff register, paper form, scanned PDF, photo folder, biometric export, bank statement, website/form export or manual register. The list is illustrative; do not claim a source exists until its custodian confirms it.

Every entry records ID, system name, owner, custodian, export method/date, years/domains, format/encoding, row/attachment counts, SHA-256, authority, confidentiality, retention, limitations, approvals and eligible waves.

Authority must be one of the nine schema states. `AUTHORITATIVE_BY_PERIOD` must name the covered period in the decision register. `CONFLICTING`, `INCOMPLETE` and `UNVERIFIED` never become import-ready through row count alone. `DO_NOT_IMPORT` stays excluded.

Unknown facts use explicit `null`, empty arrays or `UNKNOWN` decisions where the schema allows; never fabricate them.
