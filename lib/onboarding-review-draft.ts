import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { dryRunPackage, packageDigest, proposeOnboardingMappedValue, validateMappingCatalogue, validatePackage, ONBOARDING_PREPARATION_LIMITS, type MappingCatalogue, type MappingEntry } from "@/lib/onboarding-preparation";
import { generateOnboardingTemplate, parseOnboardingWorkbook } from "@/lib/onboarding-workbooks";
import { isOnboardingBundle, type OnboardingBundle, type OnboardingWorkbookRows } from "@/lib/onboarding-types";
import { validatedPrivateStorageRoot } from "@/lib/private-storage-root";

const hash = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const headerKey = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase("en-IN").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
const fields: Record<string, Record<string, string>> = {
  STUDENTS: { admissionNumber: "Admission Number", studentName: "Student Full Name", fatherName: "Father Name", motherName: "Mother Name", phone1: "Phone", phone2: "Alternate Phone", dateOfBirth: "Date of Birth", academicYearReference: "Academic Year", classReference: "Class", sectionReference: "Section", rollNo: "Roll Number", studentStatusProposal: "Student Status", notes: "Notes" },
  GUARDIANS: { guardianName: "Name", relationshipProposal: "Relationship", mobileProposal: "Mobile", emailProposal: "Email", primaryContactProposal: "Primary Contact" },
  STAFF: { employeeCode: "Employee Code", staffName: "Name", designationProposal: "Designation", employmentStatus: "Employment Status", joiningDate: "Joining Date", mobileProposal: "Mobile", workEmailProposal: "Work Email", staffType: "Staff Type", department: "Department" },
  ENROLMENT_LIFECYCLE: { academicYearReference: "Academic Year", classReference: "Class", sectionReference: "Section", enrollmentDate: "Enrollment Date", enrollmentStatus: "Status", rollNo: "Roll Number" }
};
const references = new Set(["sourceStudentReference", "sourceGuardianReference", "sourceStaffReference", "studentSourceReference", "guardianSourceReference"]);
type DraftRow = { fileId: string; sourceSheet?: string; sourceRow: number; domain: string; rowKey: string; fields: Array<{ fieldId: string; sourceValue: string; proposedValue: string; transformation: string }>; heldCodes: string[]; reviewCodes: string[]; values: Record<string, string>; record: Record<string, unknown> };

/** No authoritative services, target reads, network, approval or account creation. */
export async function createGovernedReviewDraft(input: { packageRoot: string; catalogue: MappingCatalogue; bundle: OnboardingBundle }) {
  const deadline = Date.now() + ONBOARDING_PREPARATION_LIMITS.maxProcessingMilliseconds;
  const checkDeadline = () => { if (Date.now() > deadline) throw new Error("REVIEW_PROCESSING_TIME_LIMIT_EXCEEDED"); };
  if (!input.packageRoot || !isOnboardingBundle(input.bundle)) throw new Error("REVIEW_SELECTION_REQUIRED");
  const checked = validateMappingCatalogue(JSON.parse(JSON.stringify(input.catalogue)));
  if (!checked.catalogue) throw new Error("REVIEW_MAPPING_INVALID");
  const validated = await validatePackage(input.packageRoot);
  if (!validated.manifest || !validated.digest || validated.issues.some(issue => issue.severity === "ERROR")) throw new Error("REVIEW_PACKAGE_INVALID");
  const dryRun = await dryRunPackage(input.packageRoot, checked.catalogue);
  checkDeadline();
  if (dryRun.packageDigest !== validated.digest) throw new Error("REVIEW_SOURCE_CHANGED");
  const mappingHash = hash(JSON.stringify(checked.catalogue));
  // Manifest meaning is bound as well as file content. File ordering is immaterial.
  const packageHash = hash(JSON.stringify({ ...validated.manifest, files: [...validated.manifest.files].sort((a, b) => a.fileId.localeCompare(b.fileId)), contentDigest: validated.digest }));
  const ledger: DraftRow[] = [];
  const sourceIssues = new Map<string, typeof dryRun.issues>();
  for (const issue of dryRun.issues) { const identity = `${issue.fileId}:${issue.row}`; sourceIssues.set(identity, [...(sourceIssues.get(identity) ?? []), issue]); }
  const index = new Map<string, MappingEntry>();
  for (const entry of checked.catalogue.entries) for (const alias of [entry.sourceField, ...entry.sourceAliases]) {
    const key = `${entry.domain.toUpperCase()}:${headerKey(alias)}`;
    if (index.has(key) && index.get(key)!.id !== entry.id) throw new Error("REVIEW_MAPPING_AMBIGUOUS");
    index.set(key, entry);
  }
  for (const table of [...validated.tables].sort((a, b) => a.fileId.localeCompare(b.fileId))) {
    const domain = table.domain.toUpperCase();
    for (const [i, source] of table.rows.entries()) {
      checkDeadline();
      const sourceRow = table.sourceRows?.[i] ?? i + 2;
      const row: DraftRow = { fileId: table.fileId, sourceSheet: table.sourceSheet, sourceRow, domain, rowKey: `SRC:${table.fileId}:${sourceRow}`, fields: [], heldCodes: [], reviewCodes: [], values: {}, record: {} };
      if (!(domain in fields) || input.bundle === "STAFF" && domain !== "STAFF" || input.bundle === "STUDENT_GUARDIAN" && domain === "STAFF") row.heldCodes.push("DOMAIN_OUTSIDE_BUNDLE");
      if (!["AUTHORITATIVE_PRIMARY", "AUTHORITATIVE_BY_PERIOD"].includes(validated.manifest.sourceClassification)) row.heldCodes.push("SOURCE_AUTHORITY_REVIEW_REQUIRED");
      const targets = new Set<string>();
      for (const [col, raw] of source.entries()) {
        const fieldId = table.headers[col] ?? "";
        const entry = index.get(`${domain}:${headerKey(fieldId)}`);
        if (!entry) { row.fields.push({ fieldId: headerKey(fieldId), sourceValue: raw, proposedValue: raw, transformation: "UNMAPPED" }); if (raw) row.heldCodes.push("UNMAPPED_FIELD"); continue; }
        // Preserve meaning. Date and phone interpretation belongs to the production planner.
        const proposedValue = proposeOnboardingMappedValue(raw, entry);
        row.fields.push({ fieldId: entry.id, sourceValue: raw, proposedValue, transformation: entry.transformation });
        const target = fields[domain]?.[entry.proposedTargetField];
        if (entry.unsupportedReason || !/^MIGRATE_(REQUIRED|OPTIONAL)$/.test(entry.minimisationDecision) || !target && !references.has(entry.proposedTargetField)) { if (raw) row.heldCodes.push("FIELD_OUTSIDE_GOVERNED_CONTRACT"); continue; }
        row.values[entry.proposedTargetField] = proposedValue;
        if (target) {
          if (targets.has(target)) row.heldCodes.push("CONFLICTING_FIELD_MAPPING");
          targets.add(target); row.record[target] = proposedValue;
        }
      }
      for (const issue of sourceIssues.get(`${table.fileId}:${sourceRow}`) ?? []) {
        row.reviewCodes.push(issue.code);
        // Target references and shared contacts are reviewed by the governed planner.
        // Unmapped nonempty fields are already held above. Source identity ambiguity stays held.
        if (!["CLASS_SECTION_REFERENCE_UNRESOLVED", "SUPPORTING_CONTACT_DUPLICATE", "REQUIRED_VALUE_MISSING", "DECLARED_DATE_INVALID"].includes(issue.code)) row.heldCodes.push(issue.code);
      }
      ledger.push(row);
    }
  }
  const rows: Omit<OnboardingWorkbookRows, "metadata"> = { students: [], guardians: [], links: [], enrollments: [], staff: [] };
  function resolve(domain: string, field: string, value: string | undefined, owner: DraftRow) {
    const matches = ledger.filter(row => row.domain === domain && value && row.values[field] === value);
    if (matches.length !== 1) { owner.heldCodes.push(matches.length > 1 ? "AMBIGUOUS_SOURCE_REFERENCE" : "MISSING_SOURCE_REFERENCE"); return ""; }
    return matches[0].rowKey;
  }
  for (const row of ledger) {
    if (row.domain === "STUDENTS" && input.bundle !== "STAFF") rows.students.push({ ...row.record, "Import Row Key": row.rowKey });
    if (row.domain === "GUARDIANS" && input.bundle !== "STAFF") {
      const { "Primary Contact": primary, ...guardian } = row.record;
      rows.guardians.push({ ...guardian, "Guardian Row Key": row.rowKey });
      // A relationship must be explicitly sourced; neither names nor shared phones resolve it.
      rows.links.push({ "Link Row Key": `${row.rowKey}:LINK`, "Guardian Row Key": row.rowKey, "Student Row Key": resolve("STUDENTS", "sourceStudentReference", row.values.studentSourceReference, row), "Relationship to Student": row.record.Relationship ?? "", "Primary Contact": primary ?? "" });
    }
    if (row.domain === "ENROLMENT_LIFECYCLE" && input.bundle !== "STAFF") rows.enrollments.push({ ...row.record, "Enrollment Row Key": row.rowKey, "Student Row Key": resolve("STUDENTS", "sourceStudentReference", row.values.studentSourceReference, row) });
    if (row.domain === "STAFF" && input.bundle !== "STUDENT_GUARDIAN") rows.staff.push({ ...row.record, "Staff Row Key": row.rowKey });
  }
  for (const row of ledger.filter(row => row.domain === "STUDENTS" && input.bundle !== "STAFF")) {
    if (!rows.links.some(link => link["Student Row Key"] === row.rowKey)) row.heldCodes.push("GUARDIAN_LINK_SOURCE_REQUIRED");
    if (!rows.enrollments.some(enrollment => enrollment["Student Row Key"] === row.rowKey)) row.heldCodes.push("ENROLLMENT_SOURCE_REQUIRED");
    if (row.values.guardianSourceReference && !rows.links.some(link => link["Student Row Key"] === row.rowKey && ledger.some(guardian => guardian.rowKey === link["Guardian Row Key"] && guardian.values.sourceGuardianReference === row.values.guardianSourceReference))) row.heldCodes.push("CONFLICTING_GUARDIAN_REFERENCE");
  }
  ledger.forEach(row => { row.heldCodes = [...new Set(row.heldCodes)].sort(); });
  const heldRows = ledger.filter(row => row.heldCodes.length).length;
  const bytes = generateOnboardingTemplate({ bundle: input.bundle, rows, preparation: { packageHash, mappingHash, heldRows } });
  const parsed = parseOnboardingWorkbook(bytes, input.bundle);
  if (bytes.length > ONBOARDING_PREPARATION_LIMITS.maxFileBytes) throw new Error("REVIEW_WORKBOOK_SIZE_LIMIT");
  if (await packageDigest(input.packageRoot, validated.manifest) !== validated.digest) throw new Error("REVIEW_SOURCE_CHANGED");
  const after = await validatePackage(input.packageRoot);
  checkDeadline();
  if (!after.manifest || hash(JSON.stringify({ ...after.manifest, files: [...after.manifest.files].sort((a, b) => a.fileId.localeCompare(b.fileId)), contentDigest: after.digest })) !== packageHash) throw new Error("REVIEW_SOURCE_CHANGED");
  return { bytes, parsed, ledger, packageHash, mappingHash, workbookHash: hash(bytes), rowsReceived: ledger.length, heldRows, state: "REVIEW_CANDIDATE_GENERATED" as const, targetValidation: "REQUIRED" as const, authoritativeWrites: 0 as const };
}

/** Fresh private output only, with canonical containment and exclusive creation. */
export async function writeGovernedReviewDraft(input: { packageRoot: string; mappingPath: string; output: string; bundle: OnboardingBundle }) {
  if (!input.packageRoot || !input.mappingPath || !input.output) throw new Error("REVIEW_EXPLICIT_PATHS_REQUIRED");
  if (input.output.split(/[\\/]/).includes("..")) throw new Error("REVIEW_OUTPUT_TRAVERSAL_REFUSED");
  const sourceRoot = await realpath(input.packageRoot);
  let output: string;
  try { output = validatedPrivateStorageRoot(input.output, "Onboarding review output"); }
  catch { throw new Error("REVIEW_PRIVATE_OUTPUT_REQUIRED"); }
  // Reject aliases before creating anything, including output nested in the source.
  let current = path.parse(output).root;
  for (const part of path.relative(current, path.dirname(output)).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("REVIEW_OUTPUT_PARENT_REFUSED");
  }
  const parent = await realpath(path.dirname(output));
  const canonicalOutput = path.join(parent, path.basename(output));
  // Recheck the filesystem's canonical casing, including Windows aliases.
  try { validatedPrivateStorageRoot(canonicalOutput, "Onboarding review output"); }
  catch { throw new Error("REVIEW_PRIVATE_OUTPUT_REQUIRED"); }
  const relative = path.relative(sourceRoot, canonicalOutput);
  if (!relative || !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)) throw new Error("REVIEW_OUTPUT_INSIDE_SOURCE_REFUSED");
  const mappingStat = await lstat(input.mappingPath);
  if (!mappingStat.isFile() || mappingStat.isSymbolicLink() || mappingStat.size > ONBOARDING_PREPARATION_LIMITS.maxFileBytes) throw new Error("REVIEW_MAPPING_FILE_REFUSED");
  const catalogue = JSON.parse(await readFile(input.mappingPath, "utf8")) as MappingCatalogue;
  const draft = await createGovernedReviewDraft({ packageRoot: input.packageRoot, catalogue, bundle: input.bundle });
  const report = JSON.stringify({ ...draft, bytes: undefined, parsed: undefined }, null, 2);
  if (Buffer.byteLength(report) > ONBOARDING_PREPARATION_LIMITS.maxReportBytes) throw new Error("REVIEW_REPORT_SIZE_LIMIT");
  await mkdir(canonicalOutput, { mode: 0o700 });
  for (const [name, content] of [["review.xlsx", draft.bytes], ["review-ledger.json", report]] as const) {
    const handle = await open(path.join(canonicalOutput, name), "wx", 0o600);
    try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
    const stat = await lstat(path.join(canonicalOutput, name));
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== Buffer.byteLength(content)) throw new Error("REVIEW_OUTPUT_VERIFICATION_FAILED");
  }
  parseOnboardingWorkbook(await readFile(path.join(canonicalOutput, "review.xlsx")), input.bundle);
  return { result: draft.state, rowsReceived: draft.rowsReceived, heldRows: draft.heldRows, targetValidation: draft.targetValidation, authoritativeWrites: draft.authoritativeWrites };
}
