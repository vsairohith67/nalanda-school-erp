import { describe, expect, it } from "vitest";
import { parseAndValidateBackup, paymentFingerprint, type RestoreRecord } from "../lib/restore";
import { PRODUCT_BRAND } from "../config/product-brand";

function validBackup(): {
  metadata: Record<string, unknown>;
  students: RestoreRecord[];
  feeStructures: RestoreRecord[];
  payments: RestoreRecord[];
  paymentAudits: RestoreRecord[];
  users: RestoreRecord[];
  rolePermissions?: RestoreRecord[];
  receiptNotes: RestoreRecord[];
  importBatches?: RestoreRecord[];
  goLiveChecklist?: RestoreRecord[];
} {
  return {
    metadata: {
      appName: "Nalanda Fee Control",
      academicYear: "2026-27",
      generatedAt: "2026-06-18T12:00:00.000Z",
      generatedBy: "Director",
      appVersion: "0.1.0"
    },
    students: [],
    feeStructures: [],
    payments: [],
    paymentAudits: [],
    users: [],
    receiptNotes: []
  };
}

describe("backup restore validation", () => {
  it("accepts the current typed product name while retaining legacy backup compatibility", () => {
    const current = validBackup();
    current.metadata.appName = PRODUCT_BRAND.productName;
    expect(parseAndValidateBackup(current).metadata.appName).toBe(PRODUCT_BRAND.productName);
    expect(parseAndValidateBackup(validBackup()).metadata.appName).toBe("Nalanda Fee Control");
  });

  it("rejects invalid JSON", () => {
    expect(() => parseAndValidateBackup("{not-json")).toThrow("Invalid backup JSON");
  });

  it("rejects missing metadata and required data arrays", () => {
    expect(() => parseAndValidateBackup({ students: [], feeStructures: [], payments: [] }))
      .toThrow("Backup metadata must be an object");
    expect(() => parseAndValidateBackup({ ...validBackup(), payments: undefined }))
      .toThrow("payments must be an array");
  });

  it("removes password hashes from backup users", () => {
    const backup = validBackup();
    backup.users = [{
      id: "user-1",
      name: "Director",
      username: "director",
      role: "DIRECTOR",
      isActive: true,
      passwordHash: "must-not-survive"
    }];
    const validated = parseAndValidateBackup(backup);
    expect(validated.users[0]).not.toHaveProperty("passwordHash");
    expect(validated.users[0]).toMatchObject({ username: "director", role: "DIRECTOR" });
  });

  it("accepts old backups without import verification data", () => {
    const validated = parseAndValidateBackup(validBackup());
    expect(validated.schoolSettings).toBeNull();
    expect(validated.importBatches).toEqual([]);
    expect(validated.goLiveChecklist).toEqual([]);
    expect(validated.rolePermissions).toEqual([]);
    expect(validated.authSecurity).toEqual({
      aliases: [], verificationHistory: [], resetHistory: [], sessions: [], events: [],
      accessRequests: [], invitations: [], mfaAuthenticators: [], mfaRecoveryCodes: [],
      trainingModules: [], trainingAcknowledgements: [], policyAcknowledgements: [],
      accessCertifications: [], mfaRecoveryRequests: []
    });
    expect(validated.guardians).toEqual([]);
    expect(validated.studentGuardians).toEqual([]);
    expect(validated.notices).toEqual([]);
    expect(validated.staffMembers).toEqual([]);
    expect(validated.studentAttendanceSessions).toEqual([]);
    expect(validated.studentAttendanceRecords).toEqual([]);
    expect(validated.academicYearEnrollments).toEqual([]);
    expect(validated.studentLifecycleEvents).toEqual([]);
    expect(validated.studentProgressionDecisions).toEqual([]);
    expect(validated.timetableTeachers).toEqual([]);
    expect(validated.timetableSubjects).toEqual([]);
    expect(validated.timetableClassSections).toEqual([]);
    expect(validated.timetablePeriodTemplates).toEqual([]);
    expect(validated.timetableAssignments).toEqual([]);
    expect(validated.timetableTeacherUnavailability).toEqual([]);
    expect(validated.timetableFixedPeriods).toEqual([]);
    expect(validated.timetableDrafts).toEqual([]);
    expect(validated.timetableEntries).toEqual([]);
  });

  it("accepts an allowlisted version-37 school settings snapshot", () => {
    const validated = parseAndValidateBackup({
      ...validBackup(),
      schoolSettings: {
        id: "school",
        schoolName: "Nalanda Public School",
        addressLine1: "Nanalnagar, Mehdipatnam",
        city: "Hyderabad",
        phone: "040-23513913",
        academicYear: "2026-27",
        receiptPrefix: null,
        defaultCurrency: "INR",
        whatsappReminderFooter: "Nalanda Public School",
        logoPath: "/nalanda-logo.jpg",
        receiptTitle: "FEE RECEIPT",
        showSchoolPhone: true,
        showSchoolAddress: true,
        defaultPrintSize: "A5",
        signatureLabel: "Receiver Signature"
      }
    });

    expect(validated.schoolSettings).toMatchObject({
      id: "school",
      academicYear: "2026-27",
      defaultCurrency: "INR"
    });
  });

  it("rejects unsafe or unknown school settings fields", () => {
    const settings = {
      id: "school",
      schoolName: "Nalanda Public School",
      addressLine1: "Address",
      city: "Hyderabad",
      phone: "040-00000000",
      academicYear: "2026-27",
      receiptPrefix: null,
      defaultCurrency: "INR",
      whatsappReminderFooter: "Nalanda Public School",
      logoPath: "/nalanda-logo.jpg",
      receiptTitle: "FEE RECEIPT",
      showSchoolPhone: true,
      showSchoolAddress: true,
      defaultPrintSize: "A5",
      signatureLabel: "Receiver Signature"
    };
    expect(() => parseAndValidateBackup({
      ...validBackup(),
      schoolSettings: { ...settings, passwordHash: "forbidden" }
    })).toThrow("unknown field");
    expect(() => parseAndValidateBackup({
      ...validBackup(),
      schoolSettings: { ...settings, logoPath: "https://example.com/logo.png" }
    })).toThrow("local path");
  });

  it("accepts and validates optional timetable foundation arrays", () => {
    const backup = {
      ...validBackup(),
      timetableTeachers: [{
        id: "teacher-1",
        name: "Rani Sharma",
        shortName: "RS",
        maxPeriodsPerWeek: 30,
        isActive: false
      }],
      timetableSubjects: [{
        id: "subject-1",
        name: "Mathematics",
        shortName: "MATH"
      }],
      timetableClassSections: [{
        id: "class-1",
        academicYear: "2026-27",
        className: "VI",
        section: "A",
        groupName: "VI-X"
      }],
      timetablePeriodTemplates: [{
        id: "period-1",
        academicYear: "2026-27",
        groupName: "FRIDAY",
        dayOfWeek: "FRIDAY",
        periodNumber: 1,
        label: "Period I",
        startTime: "09:00",
        endTime: "09:40",
        type: "TEACHING",
        sortOrder: 4
      }],
      timetableAssignments: [{
        id: "assignment-1",
        academicYear: "2026-27",
        classSectionId: "class-1",
        subjectId: "subject-1",
        teacherId: "teacher-1",
        periodsPerWeek: 6
      }],
      timetableTeacherUnavailability: [{
        id: "unavailable-1",
        teacherId: "teacher-1",
        dayOfWeek: "MONDAY",
        periodNumber: 2
      }],
      timetableFixedPeriods: [{
        id: "fixed-1",
        academicYear: "2026-27",
        classSectionId: "class-1",
        dayOfWeek: "MONDAY",
        periodNumber: 1,
        label: "Assembly"
      }],
      timetableDrafts: [{
        id: "draft-1",
        academicYear: "2026-27",
        name: "Manual Draft",
        status: "DRAFT"
      }],
      timetableEntries: [{
        id: "entry-1",
        draftId: "draft-1",
        academicYear: "2026-27",
        classSectionId: "class-1",
        assignmentId: "assignment-1",
        teacherId: "teacher-1",
        subjectId: "subject-1",
        dayOfWeek: "MONDAY",
        periodNumber: 1,
        entryType: "TEACHING",
        isLocked: true
      }]
    };

    const validated = parseAndValidateBackup(backup);
    expect(validated.timetableTeachers[0]).toMatchObject({ isActive: false });
    expect(validated.timetableAssignments).toHaveLength(1);
    expect(validated.timetableFixedPeriods).toHaveLength(1);
    expect(validated.timetableDrafts).toHaveLength(1);
    expect(validated.timetableEntries[0]).toMatchObject({ entryType: "TEACHING", isLocked: true });
  });

  it("accepts and validates import verification data", () => {
    const backup = validBackup();
    backup.importBatches = [{
      id: "batch-1",
      type: "PAYMENTS",
      fileName: "payments.xlsx",
      importedByUserId: "user-1",
      importedByName: "Director",
      importedAt: "2026-06-19T10:00:00.000Z",
      mode: "dry-run",
      totalRows: 10,
      createdCount: 8,
      updatedCount: 0,
      skippedCount: 1,
      errorCount: 1,
      warningCount: 2,
      status: "DRY_RUN",
      detailsJson: "{}"
    }];
    backup.goLiveChecklist = {
      id: "go-live",
      backupTaken: true,
      paymentTotalsMatched: false
    } as unknown as RestoreRecord[];

    const validated = parseAndValidateBackup(backup);
    expect(validated.importBatches).toHaveLength(1);
    expect(validated.goLiveChecklist).toEqual([expect.objectContaining({ backupTaken: true })]);
  });

  it("accepts guardian records, guardian links, and user-to-guardian linkage without passwords", () => {
    const backup = validBackup();
    backup.users = [{
      id: "user-parent",
      name: "Parent User",
      username: "parent9000000001",
      role: "PARENT",
      isActive: true,
      guardianId: "guardian-1",
      passwordHash: "must-not-survive"
    }];
    const guardianBackup = {
      ...backup,
      guardians: [{
        id: "guardian-1",
        displayName: "Suresh Reddy",
        primaryMobile: "9000000001",
        relationship: "Father",
        status: "Active"
      }],
      studentGuardians: [{
        guardianId: "guardian-1",
        studentId: "student-1",
        relationshipToStudent: "Father",
        isPrimaryContact: true,
        canViewFees: true,
        canReceiveReminders: false
      }]
    };

    const validated = parseAndValidateBackup(guardianBackup);
    expect(validated.guardians).toHaveLength(1);
    expect(validated.studentGuardians).toHaveLength(1);
    expect(validated.users[0]).toMatchObject({ username: "parent9000000001", guardianId: "guardian-1" });
    expect(validated.users[0]).not.toHaveProperty("passwordHash");
  });

  it("accepts and normalizes role permission rows", () => {
    const backup = validBackup();
    backup.rolePermissions = [{
      role: "ACCOUNTANT",
      permission: "EXPORT_FULL_BACKUP",
      enabled: true
    }, {
      role: "SUPER_ADMIN",
      permission: "MANAGE_ROLE_PERMISSIONS",
      enabled: false
    }];

    const validated = parseAndValidateBackup(backup);
    expect(validated.rolePermissions).toEqual([
      expect.objectContaining({ role: "ACCOUNTANT", permission: "RUN_BACKUP", enabled: true }),
      expect.objectContaining({ role: "SUPER_ADMIN", permission: "MANAGE_ROLE_PERMISSIONS", enabled: true })
    ]);
  });

  it("accepts notice backups and keeps old backups without notices compatible", () => {
    const validated = parseAndValidateBackup({
      ...validBackup(),
      notices: [{
        id: "notice-1",
        title: "Holiday",
        body: "School will be closed tomorrow.",
        audienceType: "SECTION",
        className: "VI",
        section: "A",
        status: "PUBLISHED",
        publishDate: "2026-06-27T08:00:00.000Z",
        expiresAt: "2026-06-30T18:00:00.000Z"
      }]
    });
    expect(validated.notices).toHaveLength(1);
    expect(validated.notices[0]).toMatchObject({ audienceType: "SECTION", status: "PUBLISHED" });
    expect(parseAndValidateBackup(validBackup()).notices).toEqual([]);
  });

  it("rejects unsafe notice audience and status values", () => {
    expect(() => parseAndValidateBackup({
      ...validBackup(),
      notices: [{ id: "n1", title: "Bad", body: "Bad", audienceType: "PRIVATE", status: "PUBLISHED" }]
    })).toThrow("audienceType is not supported");
    expect(() => parseAndValidateBackup({
      ...validBackup(),
      notices: [{ id: "n2", title: "Bad", body: "Bad", audienceType: "ALL_PARENTS", status: "DELETED" }]
    })).toThrow("status is not supported");
  });

  it("accepts staff links while keeping old backups compatible", () => {
    const validated = parseAndValidateBackup({ ...validBackup(), staffMembers: [{
      id: "staff-1", staffCode: "T-01", fullName: "Asha Rao", staffType: "TEACHING",
      designation: "Teacher", status: "ACTIVE", userId: "user-1", timetableTeacherId: "teacher-1",
      dateOfJoining: "2024-06-01T00:00:00.000Z"
    }] });
    expect(validated.staffMembers[0]).toMatchObject({ userId: "user-1", timetableTeacherId: "teacher-1" });
    expect(() => parseAndValidateBackup({ ...validBackup(), staffMembers: [{ id: "bad", fullName: "Bad", staffType: "PAYROLL", designation: "X", status: "ACTIVE" }] })).toThrow("staffType is not supported");
    expect(() => parseAndValidateBackup({ ...validBackup(), staffMembers: [{ id: "bad-years", fullName: "Bad", staffType: "TEACHING", designation: "X", status: "ACTIVE", experienceYears: 100 }] })).toThrow("experienceYears must be between 0 and 80");
  });

  it("accepts attendance sessions and records while rejecting unsafe statuses", () => {
    const backup = { ...validBackup(), studentAttendanceSessions: [{ id: "session-1", attendanceDate: "2026-06-27T00:00:00.000Z", className: "VI", section: "A", academicYear: "2026-27", status: "LOCKED" }], studentAttendanceRecords: [{ id: "record-1", sessionId: "session-1", studentId: "student-1", admissionNo: "NPS1", status: "HALF_DAY" }] };
    const validated = parseAndValidateBackup(backup);
    expect(validated.studentAttendanceSessions[0]).toMatchObject({ status: "LOCKED" });
    expect(validated.studentAttendanceRecords[0]).toMatchObject({ status: "HALF_DAY" });
    expect(() => parseAndValidateBackup({ ...backup, studentAttendanceRecords: [{ id: "bad", sessionId: "session-1", studentId: "student-1", admissionNo: "NPS1", status: "MISSING" }] })).toThrow("status is not supported");
  });

  it("rejects unsafe role permission rows", () => {
    expect(() => parseAndValidateBackup({
      ...validBackup(),
      rolePermissions: [{ role: "NOT_A_ROLE", permission: "RUN_BACKUP", enabled: true }]
    })).toThrow("rolePermissions.role is not supported");
    expect(() => parseAndValidateBackup({
      ...validBackup(),
      rolePermissions: [{ role: "ACCOUNTANT", permission: "NOPE", enabled: true }]
    })).toThrow("rolePermissions.permission is not supported");
    expect(() => parseAndValidateBackup({
      ...validBackup(),
      rolePermissions: [{ role: "ACCOUNTANT", permission: "RUN_BACKUP", enabled: "yes" }]
    })).toThrow("rolePermissions.enabled must be a boolean");
  });

  it("uses the stable payment fields to identify duplicates", () => {
    const first = paymentFingerprint({
      receiptNo: "12501",
      admissionNo: "NPS26001",
      date: "2026-06-18T00:00:00.000Z",
      amountPaid: 7800,
      paymentMode: "UPI",
      receivedAccount: "NPS Current Account UPI"
    });
    const duplicate = paymentFingerprint({
      receiptNo: "12501",
      admissionNo: "NPS26001",
      date: "2026-06-18T15:30:00.000Z",
      amountPaid: 7800,
      paymentMode: "UPI",
      receivedAccount: "NPS Current Account UPI"
    });
    const different = paymentFingerprint({
      receiptNo: "12501",
      admissionNo: "NPS26001",
      date: "2026-06-18T00:00:00.000Z",
      amountPaid: 7801,
      paymentMode: "UPI",
      receivedAccount: "NPS Current Account UPI"
    });

    expect(duplicate).toBe(first);
    expect(different).not.toBe(first);
  });
});
