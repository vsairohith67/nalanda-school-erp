import { copyFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { PrismaClient } from "@prisma/client";
import type { AuthUser } from "../lib/auth";
import { hashPassword } from "../lib/password";
import {
  admissionReports, appendEnquiryInteraction, createAdmissionCycle, createPublicEnquiry,
  createStaffEnquiry, duplicateSuggestions, issueApplicationInvitation, loadInvitedApplication,
  resolveDuplicate, reviewOrDecideApplication, saveInvitedApplication, validatePublicEnquiry,
  convertAdmission
} from "../lib/admissions";
import { uploadApplicationDocument } from "../lib/admissions-files";
import { createAndVerifyAdmissionsAssetBackup, restoreAdmissionsAssetBackup } from "../lib/admissions-asset-backup";
import { generateFullBackup } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import {
  OPERATIONAL_DATABASE, QA_ROOT, assertSchemaEquivalent, businessBaseline,
  cleanupIsolatedDatabase, createEmptyIsolatedDatabase, databaseUrl, fileSha256, runPrisma,
  schemaInventory
} from "./migration-check-utils";

type Mode = "implementation" | "independent";
const qaCredential = () => ["Synthetic", "only", "password", "ADMIT23H", "9!"].join("-");

function invariant(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function cleanupStale(prefix: string) {
  const safe = prefix.toLowerCase();
  for (const group of ["operational-copy", "restore", "reports"] as const) {
    const directory = path.join(QA_ROOT, group);
    for (const name of readdirSync(directory, { withFileTypes: true })) {
      const match = group === "reports" ? name.name.toLowerCase().startsWith(`${safe}-`) : name.name.toLowerCase().startsWith(`devops1b-${safe}-`);
      if (!match) continue;
      const target = path.resolve(directory, name.name);
      invariant(path.dirname(target) === path.resolve(directory), "STALE_CLEANUP_SCOPE_REFUSED");
      if (name.isDirectory()) rmSync(target, { recursive: true, force: true }); else rmSync(target, { force: true });
    }
  }
}
function actor(user: { id: string; name: string; username: string; role: string; iamPublicKey: string | null }): AuthUser { return { id: user.id, name: user.name, username: user.username, email: null, designation: `${user.role} synthetic QA`, role: user.role as AuthUser["role"], roleAssignmentId: `${user.id}-assignment`, authorizationVersion: 1, mustChangePassword: false, guardianId: null }; }

async function qaUser(client: PrismaClient, prefix: string, role: string) {
  return client.user.create({ data: { iamPublicKey: randomUUID(), name: `${prefix} ${role}`, username: `${prefix.toLowerCase()}-${role.toLowerCase()}-${process.pid}`, passwordHash: await hashPassword(qaCredential()), role, isActive: true } });
}

function enquiry(prefix: string, suffix: string, contact: string) {
  return { guardianName: `${prefix} Guardian ${suffix}`, contactMethod: "PHONE", contactValue: contact, desiredAcademicYear: "2027-28", desiredClass: "I", childName: `${prefix} Child ${suffix}`, enquirySource: "WEBSITE", message: "Synthetic governed admissions QA enquiry.", privacyNoticeVersion: "ADMIT-PRIVACY-DRAFT-1", consentVersion: "ADMIT-CONSENT-DRAFT-1", consent: true, honeypot: "", requestKey: `${prefix}-REQUEST-${suffix}-0001` };
}

async function invitedApplication(client: PrismaClient, cycleKey: string, principal: AuthUser, prefix: string, suffix: string, contact: string) {
  const created = await createStaffEnquiry(client, { ...enquiry(prefix, suffix, contact), cycleKey, contactVerified: true }, principal);
  const invitation = await issueApplicationInvitation(client, created.key, {}, principal);
  const initial = await loadInvitedApplication(client, invitation.invitationToken);
  return { enquiry: created, invitation, initial };
}

async function saveAndSubmit(client: PrismaClient, token: string, version: number, prefix: string, suffix: string, contact: string, submit: boolean) {
  return saveInvitedApplication(client, token, { expectedVersion: version, fullName: `${prefix} Child ${suffix}`, dateOfBirth: "2022-04-12", desiredAcademicYear: "2027-28", desiredClass: "I", previousSchool: "Synthetic prior school", previousClass: "Nursery", guardians: [{ displayName: `${prefix} Guardian ${suffix}`, relationshipToChild: "Parent", contactMethod: "PHONE", contactValue: contact, isPrimary: true }], declarationVersion: "ADMIT-DECLARATION-DRAFT-1", declarationAccepted: true }, submit);
}

async function completeApprovedApplication(client: PrismaClient, cycleKey: string, principal: AuthUser, prefix: string, suffix: string, contact: string) {
  const invited = await invitedApplication(client, cycleKey, principal, prefix, suffix, contact);
  const draft = await saveAndSubmit(client, invited.invitation.invitationToken, invited.initial.version, prefix, suffix, contact, false);
  const submitted = await saveAndSubmit(client, invited.invitation.invitationToken, draft.version, prefix, suffix, contact, true);
  const offered = await reviewOrDecideApplication(client, invited.invitation.applicationKey, { action: "OFFER", expectedVersion: submitted.version, reason: "Synthetic QA offer after completeness review", expiresAt: "2027-05-31T12:00:00.000Z", offeredClass: "I", academicYear: "2027-28" }, principal);
  const approved = await reviewOrDecideApplication(client, invited.invitation.applicationKey, { action: "FINAL_APPROVE", expectedVersion: offered.version, reason: "Synthetic QA final approval" }, principal);
  return { ...invited, submitted, approved };
}

export async function runAdmissionsQa(mode: Mode) {
  const prefix = mode === "independent" ? "ADMIT23HQA" : "ADMIT23H";
  cleanupStale(prefix);
  const sourceHash = fileSha256(OPERATIONAL_DATABASE);
  const sourceBaseline = businessBaseline(OPERATIONAL_DATABASE);
  invariant(sourceBaseline.students === 0 && sourceBaseline.activeEnrollments === 0 && sourceBaseline.payments === 0 && sourceBaseline.collected === 0, "OPERATIONAL_BUSINESS_BASELINE_CHANGED");
  const databasePath = createEmptyIsolatedDatabase("operational-copy", `${prefix.toLowerCase()}-copied`);
  const restorePath = createEmptyIsolatedDatabase("restore", `${prefix.toLowerCase()}-restore`);
  copyFileSync(OPERATIONAL_DATABASE, databasePath);
  const privateRoot = path.join(QA_ROOT, "reports", `${prefix}-${process.pid}-private`);
  const artifactPath = path.join(QA_ROOT, "reports", `${prefix}-${process.pid}-assets.nfcenc`);
  process.env.ADMISSIONS_PRIVATE_STORAGE_ROOT = privateRoot;
  const client = new PrismaClient({ datasourceUrl: databaseUrl(databasePath) });
  const restoreClient = new PrismaClient({ datasourceUrl: databaseUrl(restorePath) });
  let success = false;
  try {
    runPrisma(["migrate", "deploy"], databasePath);
    runPrisma(["migrate", "deploy"], databasePath);
    const schema = assertSchemaEquivalent(databasePath);
    const triggerNames = new Set(schemaInventory(databasePath).triggers.map((row) => row.name));
    for (const name of ["AdmissionDecision_no_update", "AdmissionConversion_no_delete", "AdmissionEvent_no_update"]) invariant(triggerNames.has(name), `IMMUTABILITY_TRIGGER_MISSING:${name}`);

    const [principalRow, receptionistRow, adminRow, teacherRow, viewerRow, accountantRow] = await Promise.all(["PRINCIPAL", "COMPUTER_OPERATOR", "ADMIN", "TEACHER", "VIEWER", "ACCOUNTANT"].map((role) => qaUser(client, prefix, role)));
    const principal = actor(principalRow), receptionist = actor(receptionistRow), teacher = actor(teacherRow), accountant = actor(accountantRow);
    const cycle = await createAdmissionCycle(client, { cycleCode: `${prefix}_2027`, name: `${prefix} 2027-28 synthetic cycle`, academicYear: "2027-28", status: "OPEN", enabledClasses: ["I", "II"], declarations: ["Information is accurate for synthetic QA."], documentTypes: ["BIRTH_CERTIFICATE"], admissionNumberPrefix: `${prefix}-`, admissionNumberPadding: 4, applicationExpiryDays: 14, retentionReviewDays: 365 }, principal);
    const noDocumentCycle = await createAdmissionCycle(client, { cycleCode: `${prefix}_NODOC`, name: `${prefix} no-document rollback cycle`, academicYear: "2027-28", status: "OPEN", enabledClasses: ["I"], declarations: ["Information is accurate for synthetic QA."], documentTypes: [], admissionNumberPrefix: `${prefix}-R-`, admissionNumberPadding: 4, applicationExpiryDays: 14, retentionReviewDays: 365 }, principal);

    const publicInput = validatePublicEnquiry(enquiry(prefix, "PUBLIC", "9000002301"));
    await createPublicEnquiry(client, publicInput, `${prefix}|public-source`);
    await createPublicEnquiry(client, publicInput, `${prefix}|public-source`);
    invariant(await client.admissionEnquiry.count({ where: { publicRequestHash: { not: null } } }) === 1, "PUBLIC_ENQUIRY_IDEMPOTENCE_FAILED");
    await createPublicEnquiry(client, { ...publicInput, honeypot: "bot-filled" }, `${prefix}|honeypot`);
    invariant(await client.admissionEnquiry.count({ where: { guardianName: { contains: "PUBLIC" } } }) === 1, "HONEYPOT_CREATED_DATA");
    let accountantDenied = false; try { await createStaffEnquiry(client, enquiry(prefix, "DENIED", "9000002302"), accountant); } catch { accountantDenied = true; }
    invariant(accountantDenied, "ACCOUNTANT_ADMISSIONS_ACCESS_NOT_DENIED");

    const intake = await createStaffEnquiry(client, { ...enquiry(prefix, "INTAKE", "9000002303"), cycleKey: cycle.publicKey, contactVerified: true }, receptionist);
    const followed = await appendEnquiryInteraction(client, intake.key, { action: "FOLLOW_UP", expectedVersion: intake.version, interactionType: "PHONE", outcome: "Synthetic family contacted", note: "Bounded synthetic note", nextFollowUpAt: "2026-08-10T10:00:00.000Z" }, receptionist);
    await appendEnquiryInteraction(client, intake.key, { action: "SCHEDULE_VISIT", expectedVersion: followed.version, purpose: "Synthetic campus visit", scheduledAt: "2026-08-15T10:00:00.000Z" }, receptionist);

    const first = await invitedApplication(client, cycle.publicKey, principal, prefix, "PRIMARY", "9000002304");
    const tokenHashBefore = await client.admissionApplication.findUniqueOrThrow({ where: { publicKey: first.invitation.applicationKey }, select: { invitationTokenHash: true } });
    invariant(tokenHashBefore.invitationTokenHash && tokenHashBefore.invitationTokenHash !== first.invitation.invitationToken && /^[a-f0-9]{64}$/.test(tokenHashBefore.invitationTokenHash), "RAW_INVITATION_TOKEN_PERSISTED");
    const draft = await saveAndSubmit(client, first.invitation.invitationToken, first.initial.version, prefix, "PRIMARY", "9000002304", false);

    const pdf = await PDFDocument.create(); pdf.addPage([200, 200]); const pdfBytes = await pdf.save();
    const document = await uploadApplicationDocument(client, { invitationToken: first.invitation.invitationToken, documentType: "BIRTH_CERTIFICATE", file: new File([new Uint8Array(pdfBytes).buffer as ArrayBuffer], `${prefix}-birth.pdf`, { type: "application/pdf" }) });
    const generatedTestMaterial = randomBytes(32);
    const asset = await createAndVerifyAdmissionsAssetBackup(client, { artifactPath, key: generatedTestMaterial, keyVersion: "V1", restoreRoots: [path.join(privateRoot, "restore-one"), path.join(privateRoot, "restore-two")], documentPublicKeys: [document.publicKey], createdAt: new Date("2026-08-03T12:00:00.000Z") });
    invariant(asset.assetCount === 1 && asset.firstRestore.assetDigest === asset.secondRestore.assetDigest, "ASSET_DOUBLE_RESTORE_FAILED");
    const encrypted = await import("node:fs/promises").then((fs) => fs.readFile(artifactPath));
    let wrongKeyDenied = false; try { await restoreAdmissionsAssetBackup(encrypted, { key: randomBytes(32), targetRoot: path.join(privateRoot, "wrong-key") }); } catch { wrongKeyDenied = true; }
    invariant(wrongKeyDenied, "ASSET_WRONG_KEY_NOT_DENIED");
    const submitted = await saveAndSubmit(client, first.invitation.invitationToken, draft.version, prefix, "PRIMARY", "9000002304", true);
    let reusedDenied = false; try { await loadInvitedApplication(client, first.invitation.invitationToken); } catch { reusedDenied = true; }
    invariant(reusedDenied, "INVITATION_SINGLE_USE_FAILED");

    await client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${prefix} Existing Guardian`, primaryMobile: "9000002304", relationship: "Parent", status: "Active" } });
    const suggestions = await duplicateSuggestions(client, first.invitation.applicationKey);
    invariant(suggestions.automaticMerge === false && suggestions.suggestions.some((row) => row.type === "GUARDIAN"), "DUPLICATE_SUGGESTION_FAILED");
    const guardianCandidate = suggestions.suggestions.find((row) => row.type === "GUARDIAN")!;
    await resolveDuplicate(client, first.invitation.applicationKey, { candidateType: "GUARDIAN", candidateReference: guardianCandidate.reference, resolution: "LINK", reason: "Exact synthetic phone evidence reviewed by Principal" }, principal);
    const waitlisted = await reviewOrDecideApplication(client, first.invitation.applicationKey, { action: "WAITLIST", expectedVersion: submitted.version, reason: "Synthetic waitlist capacity review" }, principal);
    const offered = await reviewOrDecideApplication(client, first.invitation.applicationKey, { action: "OFFER", expectedVersion: waitlisted.version, reason: "Synthetic offer after governed review", expiresAt: "2027-05-31T12:00:00.000Z", offeredClass: "I", academicYear: "2027-28" }, principal);
    const approved = await reviewOrDecideApplication(client, first.invitation.applicationKey, { action: "FINAL_APPROVE", expectedVersion: offered.version, reason: "Synthetic final approval" }, principal);
    const conversionPair = await Promise.all([convertAdmission(client, first.invitation.applicationKey, { expectedVersion: approved.version, requestKey: `${prefix}-CONVERT-PRIMARY-001`, createParentAccount: true }, principal), convertAdmission(client, first.invitation.applicationKey, { expectedVersion: approved.version, requestKey: `${prefix}-CONVERT-PRIMARY-001`, createParentAccount: true }, principal)]);
    invariant(conversionPair[0].conversionKey === conversionPair[1].conversionKey, "CONCURRENT_CONVERSION_NOT_EXACTLY_ONCE");
    const convertedApplication = await client.admissionApplication.findUniqueOrThrow({ where: { publicKey: first.invitation.applicationKey }, include: { conversion: true } });
    invariant(Boolean(convertedApplication.conversion), "CONVERSION_LINEAGE_MISSING");
    const pendingParent = await client.user.findFirst({ where: { id: convertedApplication.conversion!.parentUserId! } });
    invariant(pendingParent?.lifecycleStatus === "PENDING_ACTIVATION" && pendingParent.isActive === false, "PARENT_ACCOUNT_ACTIVATED_DURING_CONVERSION");
    invariant(await client.payment.count({ where: { studentId: convertedApplication.conversion!.studentId } }) === 0, "PAYMENT_CREATED_DURING_CONVERSION");

    const rollbackApp = await completeApprovedApplication(client, noDocumentCycle.publicKey, principal, prefix, "ROLLBACK", "9000002305");
    const beforeRollback = { students: await client.student.count(), enrollments: await client.academicYearEnrollment.count(), guardians: await client.guardian.count(), links: await client.studentGuardian.count(), conversions: await client.admissionConversion.count() };
    await client.$executeRawUnsafe(`CREATE TRIGGER "${prefix}_force_conversion_failure" BEFORE INSERT ON "AdmissionConversion" BEGIN SELECT RAISE(ABORT, 'forced synthetic rollback'); END;`);
    let rollbackDenied = false; try { await convertAdmission(client, rollbackApp.invitation.applicationKey, { expectedVersion: rollbackApp.approved.version, requestKey: `${prefix}-ROLLBACK-REQUEST-001`, createParentAccount: false }, principal); } catch { rollbackDenied = true; }
    await client.$executeRawUnsafe(`DROP TRIGGER "${prefix}_force_conversion_failure"`);
    const afterRollback = { students: await client.student.count(), enrollments: await client.academicYearEnrollment.count(), guardians: await client.guardian.count(), links: await client.studentGuardian.count(), conversions: await client.admissionConversion.count() };
    invariant(rollbackDenied && JSON.stringify(beforeRollback) === JSON.stringify(afterRollback), "FORCED_CONVERSION_ROLLBACK_FAILED");

    const reviewApp = await invitedApplication(client, noDocumentCycle.publicKey, principal, prefix, "REVIEW", "9000002306");
    const reviewSubmitted = await saveAndSubmit(client, reviewApp.invitation.invitationToken, reviewApp.initial.version, prefix, "REVIEW", "9000002306", true);
    const assigned = await reviewOrDecideApplication(client, reviewApp.invitation.applicationKey, { action: "ASSIGN_REVIEW", expectedVersion: reviewSubmitted.version, reason: "Synthetic exact Teacher assignment", reviewerKey: teacherRow.iamPublicKey, assignmentType: "INTERVIEW", visibility: "ADMISSIONS_TEAM" }, principal);
    const reviewed = await reviewOrDecideApplication(client, reviewApp.invitation.applicationKey, { action: "SUBMIT_REVIEW", expectedVersion: assigned.version, reason: "Synthetic assigned review submitted", note: "Synthetic interview feedback", completeness: { interview: true } }, teacher);
    invariant(reviewed.status === "UNDER_REVIEW", "TEACHER_REVIEW_SCOPE_FAILED");
    let teacherDecisionDenied = false; try { await reviewOrDecideApplication(client, reviewApp.invitation.applicationKey, { action: "DECLINE", expectedVersion: reviewed.version, reason: "Teacher must not decide" }, teacher); } catch { teacherDecisionDenied = true; }
    invariant(teacherDecisionDenied, "TEACHER_DECISION_NOT_DENIED");

    const expiryApp = await invitedApplication(client, noDocumentCycle.publicKey, principal, prefix, "EXPIRED", "9000002307");
    await client.admissionApplication.update({ where: { publicKey: expiryApp.invitation.applicationKey }, data: { invitationExpiresAt: new Date("2020-01-01T00:00:00.000Z") } });
    let expiredDenied = false; try { await loadInvitedApplication(client, expiryApp.invitation.invitationToken); } catch { expiredDenied = true; }
    invariant(expiredDenied, "EXPIRED_INVITATION_NOT_DENIED");

    const viewerReport = await admissionReports(client, actor(viewerRow));
    invariant(viewerReport.suppressedMinimumGroupSize === 3 && viewerReport.staffRanking === null, "VIEWER_REPORT_SUPPRESSION_FAILED");
    const eventsBefore = await client.admissionEvent.count();
    let auditUpdateDenied = false; try { await client.$executeRawUnsafe(`UPDATE "AdmissionEvent" SET "eventType"='TAMPER' WHERE "id"=(SELECT "id" FROM "AdmissionEvent" LIMIT 1)`); } catch { auditUpdateDenied = true; }
    invariant(auditUpdateDenied && await client.admissionEvent.count() === eventsBefore, "APPEND_ONLY_AUDIT_TAMPERED");

    const backup = await generateFullBackup(client as any, { generatedBy: prefix, generatedAt: new Date("2026-08-03T13:00:00.000Z") });
    const validated = parseAndValidateBackup(JSON.stringify(backup));
    invariant(validated.metadata.backupVersion === 37 && validated.admissionConversions.length === 1, "ADMISSIONS_LOGICAL_BACKUP_INVALID");
    runPrisma(["migrate", "deploy"], restorePath);
    const restoreActor = await qaUser(restoreClient, `${prefix}RESTORE`, "SUPER_ADMIN");
    const firstRestore = await restoreValidatedBackup(restoreClient, validated, { id: restoreActor.id, name: restoreActor.name });
    const secondRestore = await restoreValidatedBackup(restoreClient, validated, { id: restoreActor.id, name: restoreActor.name });
    invariant(firstRestore.admissionCycles.created >= 2 && secondRestore.admissionCycles.skipped >= 2, "ADMISSIONS_LOGICAL_DOUBLE_RESTORE_FAILED");
    invariant(await restoreClient.admissionConversion.count() === 1, "RESTORED_CONVERSION_LINEAGE_MISSING");

    invariant(fileSha256(OPERATIONAL_DATABASE) === sourceHash && JSON.stringify(businessBaseline(OPERATIONAL_DATABASE)) === JSON.stringify(sourceBaseline), "OPERATIONAL_DATABASE_MUTATED");
    console.log(JSON.stringify({ status: mode === "independent" ? "ADMIT23HQA_COPIED_DB_PASSED" : "ADMIT23H_COPIED_DB_PASSED", prefix, migration: { models: schema.models, tables: schema.tables, triggers: triggerNames.size }, publicEnquiries: 1, invitation: { hashOnly: true, singleUse: true, expiry: true }, documents: { validated: true, encryptedBackup: true, doubleRestore: true, wrongKeyDenied }, duplicates: { suggestions: suggestions.suggestions.length, automaticMerge: false }, conversion: { exactlyOnce: true, rollback: true, pendingParent: true, paymentsCreated: 0 }, roles: { principal: true, receptionist: true, teacherAssignedOnly: true, viewerSuppressed: true, accountantDenied: true }, backup: { version: validated.metadata.backupVersion, logicalDoubleRestore: true }, operationalUnchanged: true }, null, 2));
    success = true;
  } finally {
    await client.$disconnect().catch(() => undefined);
    await restoreClient.$disconnect().catch(() => undefined);
    if (success) {
      cleanupIsolatedDatabase(databasePath);
      cleanupIsolatedDatabase(restorePath);
      if (existsSync(privateRoot)) rmSync(privateRoot, { recursive: true, force: true });
      if (existsSync(artifactPath)) rmSync(artifactPath, { force: true });
    }
  }
}
