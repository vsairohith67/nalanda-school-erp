import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { packageDigest, type PackageManifest } from "@/lib/onboarding-preparation";

/** Every value is invented. No source path, operational database or private helper. */
export async function inventedReviewPackage(root: string, suffix = "one", options: { missingFather?: boolean; finance?: boolean; admission?: string; year?: string; phone?: string; staffOnly?: boolean } = {}) {
  await mkdir(root);
  const year = options.year ?? "2026-27";
  const studentId = `SYNTH-STUDENT-${suffix}`, guardianId = `SYNTH-GUARDIAN-${suffix}`;
  const data = options.staffOnly ? [{ fileId: "SYNTH-STAFF", domain: "STAFF", relativePath: "staff.csv", text: `source_staff_id,employee_code,staff_name,staff_type,designation,department,joining_date,phone,employment_status\r\nSYNTH-STAFF-${suffix},000-STAFF,SYNTHETIC ఉపాధ్యాయుడు,TEACHING,Teacher,Academics,2026-06-01,8000000005,ACTIVE\r\n` }] : [
    { fileId: "SYNTH-STUDENTS", domain: "STUDENTS", relativePath: "students.csv", text: `source_student_id,admission_number,student_name,father_name,phone,academic_year,class,section,student_status,source_guardian_id\r\n${studentId},${options.admission ?? `000-${suffix}`},SYNTHETIC విద్యార్థి हिन्दी العربية,${options.missingFather ? "" : "SYNTHETIC Father"},${options.phone ?? "8000000001"},${year},I,A,ACTIVE,${guardianId}\r\n` },
    { fileId: "SYNTH-GUARDIANS", domain: "GUARDIANS", relativePath: "guardians.csv", text: `source_guardian_id,guardian_name,relationship,phone,source_student_id,primary_contact\r\n${guardianId},SYNTHETIC Guardian,Father,${options.phone ?? "8000000001"},${studentId},YES\r\n` },
    { fileId: "SYNTH-ENROLLMENTS", domain: "ENROLMENT_LIFECYCLE", relativePath: "enrollments.csv", text: `source_student_id,academic_year,class,section,enrollment_date,enrollment_status\r\n${studentId},${year},I,A,2026-06-01,ACTIVE\r\n` },
    ...(options.finance ? [{ fileId: "SYNTH-FINANCE", domain: "FINANCE", relativePath: "finance.csv", text: `source_student_id,payment_amount,reconciliation_state\r\n${studentId},10.25,MATCH\r\n` }] : [])
  ];
  const files = [];
  for (const file of data) {
    const bytes = Buffer.from(file.text); await writeFile(path.join(root, file.relativePath), bytes, { flag: "wx" });
    files.push({ fileId: file.fileId, domain: file.domain, relativePath: file.relativePath, format: "CSV" as const, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  const manifest: PackageManifest = { schemaVersion: "1.0", packageId: "SYNTH-REVIEW", sourceId: "SYNTH-TEST", sourceOwner: "Invented owner", exportingPerson: "Invented exporter", exportTimestamp: "2026-10-04T00:00:00Z", receivedTimestamp: "2026-10-04T00:00:00Z", originalFilename: "synthetic-test-only", fileSize: files.reduce((n, f) => n + f.sizeBytes, 0), sha256: "", format: "CSV", declaredEncoding: "UTF-8", declaredAcademicYears: [year], recordDomains: [...new Set(files.map(file => file.domain))], confidentiality: "PRIVATE", transferMethod: "SYNTHETIC_LOCAL", malwareScanResult: "SYNTHETIC_FIXTURE", validationResult: "PENDING", approvalState: "SOURCE_RECEIVED", retentionDeadline: null, supersededPackageReference: null, sourceClassification: "AUTHORITATIVE_PRIMARY", files };
  manifest.sha256 = await packageDigest(root, manifest);
  await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest), { flag: "wx" });
  return manifest;
}
