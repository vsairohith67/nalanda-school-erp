export const GUARDIAN_RELATIONSHIPS = ["Parent", "Father", "Mother", "Guardian", "Other"] as const;
export const GUARDIAN_STATUSES = ["Active", "Inactive"] as const;

export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];
export type GuardianStatus = (typeof GUARDIAN_STATUSES)[number];
