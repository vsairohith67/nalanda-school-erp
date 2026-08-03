import type { PrismaClient } from "@prisma/client";

export const ADMISSIONS_BACKUP_KEYS = [
  "admissionCycles", "admissionEnquiries", "enquiryFollowUps", "schoolVisits",
  "admissionApplications", "admissionApplicationVersions", "applicantChildren",
  "prospectiveGuardians", "applicationDocuments", "applicationReviews",
  "admissionDecisions", "admissionOffers", "admissionDuplicateResolutions",
  "admissionConversions", "admissionEvents"
] as const;

export type AdmissionsBackupKey = (typeof ADMISSIONS_BACKUP_KEYS)[number];
export type AdmissionsBackup = Record<AdmissionsBackupKey, Record<string, unknown>[]>;

const DELEGATE: Record<AdmissionsBackupKey, string> = {
  admissionCycles: "admissionCycle",
  admissionEnquiries: "admissionEnquiry",
  enquiryFollowUps: "enquiryFollowUp",
  schoolVisits: "schoolVisit",
  admissionApplications: "admissionApplication",
  admissionApplicationVersions: "admissionApplicationVersion",
  applicantChildren: "applicantChild",
  prospectiveGuardians: "prospectiveGuardian",
  applicationDocuments: "applicationDocument",
  applicationReviews: "applicationReview",
  admissionDecisions: "admissionDecision",
  admissionOffers: "admissionOffer",
  admissionDuplicateResolutions: "admissionDuplicateResolution",
  admissionConversions: "admissionConversion",
  admissionEvents: "admissionEvent"
};

const ORDER: AdmissionsBackupKey[] = [
  "admissionCycles", "admissionEnquiries", "enquiryFollowUps", "schoolVisits",
  "admissionApplications", "admissionApplicationVersions", "applicantChildren",
  "prospectiveGuardians", "applicationDocuments", "applicationReviews",
  "admissionDecisions", "admissionOffers", "admissionDuplicateResolutions",
  "admissionConversions", "admissionEvents"
];

export async function loadAdmissionsBackup(client: PrismaClient): Promise<AdmissionsBackup> {
  const entries = await Promise.all(ORDER.map(async (key) => {
    const delegate = (client as any)[DELEGATE[key]];
    const rows = delegate?.findMany ? await delegate.findMany({ orderBy: { createdAt: "asc" } }) : [];
    return [key, rows] as const;
  }));
  return Object.fromEntries(entries) as AdmissionsBackup;
}

export function validateAdmissionsBackupRows(root: Record<string, unknown>): AdmissionsBackup {
  const result = Object.fromEntries(ADMISSIONS_BACKUP_KEYS.map((key) => [key, rows(root[key], key)])) as AdmissionsBackup;
  for (const row of result.admissionApplications) {
    const hash = row.invitationTokenHash;
    if (hash != null && !/^[a-f0-9]{64}$/.test(String(hash))) throw new Error("Admissions backup contains an invalid invitation token hash.");
  }
  const serialized = JSON.stringify(result);
  for (const forbidden of ["invitationToken\"", "originalLocalPath", "exif", "aadhaar", "panNumber", "bankAccount"]) {
    if (serialized.toLowerCase().includes(forbidden.toLowerCase())) throw new Error("Admissions backup contains a prohibited field.");
  }
  return result;
}

export function admissionsBackupCount(backup: AdmissionsBackup) {
  return ADMISSIONS_BACKUP_KEYS.reduce((total, key) => total + backup[key].length, 0);
}

export async function restoreAdmissionsBackup(client: PrismaClient, backup: AdmissionsBackup) {
  const result = Object.fromEntries(ADMISSIONS_BACKUP_KEYS.map((key) => [key, { created: 0, skipped: 0, errors: [] as string[] }])) as Record<AdmissionsBackupKey, { created: number; skipped: number; errors: string[] }>;
  for (const key of ORDER) {
    const delegate = (client as any)[DELEGATE[key]];
    for (const [index, row] of backup[key].entries()) {
      try {
        const id = String(row.id ?? "");
        if (!id) throw new Error("missing preserved ID");
        if (await delegate.findUnique({ where: { id }, select: { id: true } })) { result[key].skipped++; continue; }
        await delegate.create({ data: row });
        result[key].created++;
      } catch (error) {
        result[key].errors.push(`${key}[${index}]: ${error instanceof Error ? error.message : "restore failed"}`);
      }
    }
  }
  return result;
}

function rows(value: unknown, label: string) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100_000) throw new Error(`${label} must be a bounded array.`);
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${label}[${index}] must be an object.`);
    const row = item as Record<string, unknown>;
    if (!row.id || Object.keys(row).length > 80) throw new Error(`${label}[${index}] is malformed.`);
    return row;
  });
}
