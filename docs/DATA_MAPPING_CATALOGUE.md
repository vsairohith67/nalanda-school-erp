# Data Mapping Catalogue

The [machine-readable catalogue](../config/onboarding/mapping-catalogue.json) has 89 entries and validates against its [schema](../config/onboarding/mapping-catalogue.schema.json). The empty [review template](../templates/onboarding/field-mapping.csv) supports future source-specific decisions.

Every entry records domain, source field/aliases/type/format, proposed target service/field, transformation, validation, requirement, authority, conflict policy, privacy classification, minimisation decision, wave, approval owner and unsupported reason. Direct Prisma/database-column mappings are refused.

Student/Guardian/Staff fields map to the cleared governed onboarding and lifecycle/IAM proposal contracts. Finance fields map to review contracts until a separately approved finance migration service exists. Academic history maps to archive/review contracts. Documents map to inventory review only. Optional modules default to `START FRESH`.

The catalogue is a proposal, not Nalanda source policy. Source authority, aliases, dates, enums and conflict precedence require owner approval for each package. Material normalization retains both `SOURCE_VALUE` and `PROPOSED_NORMALIZED_VALUE`.
