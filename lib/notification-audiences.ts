import type { AuthUser } from "@/lib/auth";
import { notificationPathAllowedForRole } from "@/lib/notification-links";

export const NOTIFICATION_AUDIENCE_TYPES = [
  "ALL_PARENTS", "ALL_TEACHERS", "ALL_STAFF", "ROLE", "CLASS", "CLASS_SECTION",
  "SPECIFIC_STUDENTS", "SPECIFIC_GUARDIANS", "SPECIFIC_STAFF", "SPECIFIC_USERS",
  "TEACHER_TIMETABLE_SCOPE"
] as const;

export const NOTIFICATION_CONTEXT_TYPES = ["GENERAL_USER", "GUARDIAN", "GUARDIAN_STUDENT", "STAFF", "TEACHER"] as const;
export const NOTIFICATION_SKIP_REASONS = [
  "NO_ACTIVE_USER", "NO_LINKED_GUARDIAN", "INACTIVE_USER", "OUTSIDE_SCOPE",
  "DUPLICATE_USER", "INVALID_TARGET", "MISSING_ENROLLMENT", "MISSING_STAFF_LINK"
] as const;

export type ResolvedNotificationRecipient = {
  userId: string;
  role: string;
  contextType: (typeof NOTIFICATION_CONTEXT_TYPES)[number];
  context: Record<string, unknown>;
};
export type SkippedNotificationRecipient = {
  targetType: string;
  targetReferenceKey: string;
  reasonCode: (typeof NOTIFICATION_SKIP_REASONS)[number];
  safeContext?: Record<string, unknown>;
};
export type NotificationAudienceResolution = {
  recipients: ResolvedNotificationRecipient[];
  skipped: SkippedNotificationRecipient[];
  summary: Record<string, unknown>;
};

type AudienceClient = {
  user: { findMany(args: any): Promise<any[]> };
  academicYearEnrollment: { findMany(args: any): Promise<any[]> };
  guardian: { findMany(args: any): Promise<any[]> };
  staffMember: { findMany(args: any): Promise<any[]>; findUnique(args: any): Promise<any> };
  timetableAssignment: { findFirst(args: any): Promise<any> };
};

export function validateAudienceDefinition(audienceType: unknown, definition: unknown) {
  const type = String(audienceType ?? "").trim().toUpperCase();
  if (!(NOTIFICATION_AUDIENCE_TYPES as readonly string[]).includes(type)) throw new Error("Choose a valid notification audience.");
  const source = definition && typeof definition === "object" && !Array.isArray(definition)
    ? definition as Record<string, unknown>
    : {};
  const academicYear = optional(source.academicYear) ?? "2026-27";
  if (type === "ROLE") {
    const role = optional(source.role)?.toUpperCase();
    if (!role || !["PARENT", "TEACHER", "ACCOUNTANT", "ADMIN", "PRINCIPAL", "DIRECTOR", "VIEWER"].includes(role)) {
      throw new Error("Choose an allowed role audience.");
    }
    return { role };
  }
  if (type === "CLASS" || type === "CLASS_SECTION" || type === "TEACHER_TIMETABLE_SCOPE") {
    const className = required(source.className, "Class");
    const section = type === "CLASS" ? null : required(source.section, "Section").toUpperCase();
    const subjectId = type === "TEACHER_TIMETABLE_SCOPE" ? required(source.subjectId, "Subject") : null;
    return { academicYear, className, section, ...(subjectId ? { subjectId } : {}) };
  }
  const listKey: Record<string, string> = {
    SPECIFIC_STUDENTS: "studentIds",
    SPECIFIC_GUARDIANS: "guardianIds",
    SPECIFIC_STAFF: "staffIds",
    SPECIFIC_USERS: "userIds"
  };
  const key = listKey[type];
  if (key) {
    const values = Array.isArray(source[key])
      ? [...new Set(source[key].map((value) => String(value).trim()).filter(Boolean))]
      : [];
    if (!values.length || values.length > 500) throw new Error(`Choose between 1 and 500 exact ${key.replace("Ids", "")} targets.`);
    return { [key]: values, ...(type === "SPECIFIC_STUDENTS" ? { academicYear } : {}) };
  }
  return { academicYear };
}

export async function resolveNotificationAudience(
  client: AudienceClient,
  input: {
    audienceType: string;
    definition: unknown;
    actor: Pick<AuthUser, "id" | "role">;
    actionPath?: string | null;
  }
): Promise<NotificationAudienceResolution> {
  const definition = validateAudienceDefinition(input.audienceType, input.definition) as Record<string, any>;
  const type = input.audienceType;
  if (input.actor.role === "TEACHER" && type !== "TEACHER_TIMETABLE_SCOPE") {
    throw new Error("Teachers may target only their exact timetable scope.");
  }

  if (type === "SPECIFIC_GUARDIANS") {
    return resolveSpecificGuardianAudience(client, definition.guardianIds, definition.academicYear ?? "2026-27", input.actionPath);
  }

  if (["ALL_PARENTS", "CLASS", "CLASS_SECTION", "SPECIFIC_STUDENTS", "TEACHER_TIMETABLE_SCOPE"].includes(type)) {
    let filter: Record<string, any> = { academicYear: definition.academicYear ?? "2026-27", status: "ACTIVE" };
    let teacherScope: any = null;
    if (type === "CLASS" || type === "CLASS_SECTION") {
      filter = { ...filter, className: definition.className, ...(definition.section ? { section: definition.section } : {}) };
    } else if (type === "SPECIFIC_STUDENTS") {
      filter = { ...filter, studentId: { in: definition.studentIds } };
    } else if (type === "TEACHER_TIMETABLE_SCOPE") {
      const staff = await client.staffMember.findUnique({
        where: { userId: input.actor.id },
        select: { id: true, status: true, timetableTeacherId: true }
      });
      if (!staff || staff.status !== "ACTIVE" || !staff.timetableTeacherId) {
        throw new Error("No complete active StaffMember and timetable Teacher link is available.");
      }
      teacherScope = await client.timetableAssignment.findFirst({
        where: {
          teacherId: staff.timetableTeacherId,
          academicYear: definition.academicYear,
          subjectId: definition.subjectId,
          classSection: { className: definition.className, section: definition.section, isActive: true }
        },
        select: { subject: { select: { name: true } }, classSection: { select: { className: true, section: true, displayName: true } } }
      });
      if (!teacherScope) throw new Error("The requested class, section, and subject are outside this Teacher's timetable scope.");
      filter = {
        academicYear: definition.academicYear,
        status: "ACTIVE",
        className: teacherScope.classSection.className,
        section: teacherScope.classSection.section
      };
    }

    const enrollments = await client.academicYearEnrollment.findMany({
      where: filter,
      select: {
        student: {
          select: {
            id: true,
            admissionNo: true,
            studentName: true,
            className: true,
            section: true,
            deletedAt: true,
            guardians: {
              select: {
                guardian: {
                  select: {
                    id: true,
                    displayName: true,
                    status: true,
                    users: { select: { id: true, role: true, isActive: true } }
                  }
                }
              }
            }
          }
        }
      }
    });
    const recipients = new Map<string, ResolvedNotificationRecipient>();
    const skipped: SkippedNotificationRecipient[] = [];
    if (type === "SPECIFIC_STUDENTS") {
      const resolvedStudentIds = new Set(enrollments.map((row: any) => row.student.id));
      for (const studentId of definition.studentIds as string[]) {
        if (!resolvedStudentIds.has(studentId)) {
          skipped.push({ targetType: "STUDENT", targetReferenceKey: studentId, reasonCode: "MISSING_ENROLLMENT" });
        }
      }
    }
    for (const enrollment of enrollments) {
      const student = enrollment.student;
      if (student.deletedAt) continue;
      const links = student.guardians;
      if (!links.length) {
        skipped.push({ targetType: "STUDENT", targetReferenceKey: student.admissionNo, reasonCode: "NO_LINKED_GUARDIAN" });
        continue;
      }
      for (const link of links) {
        const activeUsers = link.guardian.users.filter((user: any) => user.role === "PARENT" && user.isActive);
        if (!activeUsers.length) {
          skipped.push({
            targetType: "GUARDIAN",
            targetReferenceKey: `Guardian for ${student.admissionNo}`,
            reasonCode: "NO_ACTIVE_USER",
            safeContext: { classSection: classSection(student) }
          });
          continue;
        }
        for (const user of activeUsers) {
          if (input.actionPath && !notificationPathAllowedForRole(input.actionPath, user.role)) {
            throw new Error("The action path is not safe for the resolved Parent audience.");
          }
          const child = { admissionNo: student.admissionNo, displayName: student.studentName, classSection: classSection(student) };
          const existing = recipients.get(user.id);
          if (existing) {
            const children = Array.isArray(existing.context.targetedChildren) ? existing.context.targetedChildren as any[] : [];
            if (!children.some((item) => item.admissionNo === child.admissionNo)) children.push(child);
            existing.context.targetedChildren = children;
          } else {
            recipients.set(user.id, {
              userId: user.id,
              role: "PARENT",
              contextType: "GUARDIAN_STUDENT",
              context: { targetedChildren: [child] }
            });
          }
        }
      }
    }
    return {
      recipients: [...recipients.values()],
      skipped,
      summary: {
        audienceType: type,
        academicYear: definition.academicYear,
        classSection: teacherScope?.classSection.displayName ?? (definition.className ? `${definition.className}${definition.section ? `-${definition.section}` : ""}` : "All active enrollments"),
        subject: teacherScope?.subject.name ?? null,
        intendedStudents: enrollments.length,
        resolvedUsers: recipients.size,
        skipped: skipped.length
      }
    };
  }

  if (["ALL_TEACHERS", "ALL_STAFF", "SPECIFIC_STAFF"].includes(type)) {
    const staff = await client.staffMember.findMany({
      where: {
        ...(type === "SPECIFIC_STAFF" ? {} : { status: "ACTIVE" }),
        ...(type === "ALL_TEACHERS" ? { staffType: "TEACHING" } : {}),
        ...(type === "SPECIFIC_STAFF" ? { id: { in: definition.staffIds } } : {})
      },
      select: { id: true, status: true, staffCode: true, displayName: true, fullName: true, staffType: true, timetableTeacherId: true, user: { select: { id: true, role: true, isActive: true } } }
    });
    const recipients: ResolvedNotificationRecipient[] = [];
    const skipped: SkippedNotificationRecipient[] = [];
    if (type === "SPECIFIC_STAFF") {
      const foundIds = new Set(staff.map((row: any) => row.id));
      for (const staffId of definition.staffIds as string[]) {
        if (!foundIds.has(staffId)) skipped.push({ targetType: "STAFF", targetReferenceKey: staffId, reasonCode: "INVALID_TARGET" });
      }
    }
    for (const member of staff) {
      if (member.status && member.status !== "ACTIVE") {
        skipped.push({ targetType: "STAFF", targetReferenceKey: member.staffCode ?? member.id, reasonCode: "INACTIVE_USER" });
        continue;
      }
      if (!member.user || !member.user.isActive) {
        skipped.push({ targetType: "STAFF", targetReferenceKey: member.staffCode ?? member.id, reasonCode: member.user ? "INACTIVE_USER" : "MISSING_STAFF_LINK" });
        continue;
      }
      if (type === "ALL_TEACHERS" && (member.user.role !== "TEACHER" || !member.timetableTeacherId)) {
        skipped.push({ targetType: "STAFF", targetReferenceKey: member.staffCode ?? member.id, reasonCode: "MISSING_STAFF_LINK" });
        continue;
      }
      if (input.actionPath && !notificationPathAllowedForRole(input.actionPath, member.user.role)) {
        throw new Error("The action path is not safe for the resolved Staff/Teacher audience.");
      }
      recipients.push({
        userId: member.user.id,
        role: member.user.role,
        contextType: member.user.role === "TEACHER" ? "TEACHER" : "STAFF",
        context: { staffCode: member.staffCode, displayName: member.displayName ?? member.fullName }
      });
    }
    return { recipients: dedupe(recipients), skipped, summary: { audienceType: type, intendedStaff: staff.length, resolvedUsers: new Set(recipients.map((row) => row.userId)).size, skipped: skipped.length } };
  }

  if (type === "ROLE" || type === "SPECIFIC_USERS") {
    if (input.actor.role === "TEACHER") throw new Error("Teachers cannot search or target arbitrary users.");
    if (type === "ROLE" && definition.role === "PARENT") {
      const parentResult = await resolveNotificationAudience(client, {
        audienceType: "ALL_PARENTS",
        definition: { academicYear: "2026-27" },
        actor: input.actor,
        actionPath: input.actionPath
      });
      return { ...parentResult, summary: { ...parentResult.summary, audienceType: "ROLE", role: "PARENT" } };
    }
    const users = await client.user.findMany({
      where: type === "ROLE"
        ? { role: definition.role, isActive: true }
        : { id: { in: definition.userIds }, role: { in: ["PARENT", "TEACHER", "ACCOUNTANT", "ADMIN", "PRINCIPAL", "DIRECTOR", "VIEWER"] } },
      select: { id: true, role: true, isActive: true, name: true, guardianId: true }
    });
    const skipped: SkippedNotificationRecipient[] = [];
    if (type === "SPECIFIC_USERS") {
      const foundIds = new Set(users.map((row: any) => row.id));
      for (const userId of definition.userIds as string[]) {
        if (!foundIds.has(userId)) skipped.push({ targetType: "USER", targetReferenceKey: userId, reasonCode: "INVALID_TARGET" });
      }
    }
    const activeUsers = users.filter((user: any) => {
      if (user.isActive) return true;
      skipped.push({ targetType: "USER", targetReferenceKey: user.id, reasonCode: "INACTIVE_USER" });
      return false;
    });
    const nonParents = activeUsers.filter((user: any) => user.role !== "PARENT");
    for (const user of nonParents) {
      if (input.actionPath && !notificationPathAllowedForRole(input.actionPath, user.role)) throw new Error("The action path is not safe for every resolved role.");
    }
    const recipients: ResolvedNotificationRecipient[] = nonParents.map((user: any) => ({
      userId: user.id,
      role: user.role,
      contextType: "GENERAL_USER",
      context: { role: user.role }
    }));
    const parentUsers = activeUsers.filter((user: any) => user.role === "PARENT");
    const guardianIds = parentUsers.map((user: any) => user.guardianId).filter(Boolean);
    for (const user of parentUsers) {
      if (!user.guardianId) skipped.push({ targetType: "USER", targetReferenceKey: user.id, reasonCode: "NO_LINKED_GUARDIAN" });
    }
    if (guardianIds.length) {
      const parentResult = await resolveSpecificGuardianAudience(client, guardianIds, "2026-27", input.actionPath);
      const intendedParentIds = new Set(parentUsers.map((user: any) => user.id));
      recipients.push(...parentResult.recipients.filter((row) => intendedParentIds.has(row.userId)));
      skipped.push(...parentResult.skipped);
    }
    return {
      recipients: dedupe(recipients),
      skipped,
      summary: {
        audienceType: type,
        role: definition.role ?? null,
        resolvedUsers: new Set(recipients.map((row) => row.userId)).size,
        skipped: skipped.length
      }
    };
  }

  throw new Error("Notification audience could not be resolved safely.");
}

async function resolveSpecificGuardianAudience(
  client: AudienceClient,
  guardianIds: string[],
  academicYear: string,
  actionPath?: string | null
): Promise<NotificationAudienceResolution> {
  const guardians = await client.guardian.findMany({
    where: { id: { in: guardianIds } },
    select: {
      id: true,
      status: true,
      users: { select: { id: true, role: true, isActive: true } },
      students: {
        select: {
          student: {
            select: {
              id: true,
              admissionNo: true,
              studentName: true,
              className: true,
              section: true,
              deletedAt: true,
              academicYearEnrollments: {
                where: { academicYear, status: "ACTIVE" },
                select: { className: true, section: true }
              }
            }
          }
        }
      }
    }
  });
  const recipients = new Map<string, ResolvedNotificationRecipient>();
  const skipped: SkippedNotificationRecipient[] = [];
  const foundIds = new Set(guardians.map((row: any) => row.id));
  for (const guardianId of guardianIds) {
    if (!foundIds.has(guardianId)) skipped.push({ targetType: "GUARDIAN", targetReferenceKey: guardianId, reasonCode: "INVALID_TARGET" });
  }
  for (const guardian of guardians) {
    if (guardian.status && guardian.status.toUpperCase() !== "ACTIVE") {
      skipped.push({ targetType: "GUARDIAN", targetReferenceKey: guardian.id, reasonCode: "INVALID_TARGET" });
      continue;
    }
    const children = guardian.students
      .map((link: any) => link.student)
      .filter((student: any) => !student.deletedAt && student.academicYearEnrollments.length)
      .map((student: any) => {
        const enrollment = student.academicYearEnrollments[0];
        return {
          admissionNo: student.admissionNo,
          displayName: student.studentName,
          classSection: `${enrollment.className}${enrollment.section ? `-${enrollment.section}` : ""}`
        };
      });
    if (!children.length) {
      skipped.push({ targetType: "GUARDIAN", targetReferenceKey: guardian.id, reasonCode: "NO_LINKED_GUARDIAN" });
      continue;
    }
    const activeUsers = guardian.users.filter((user: any) => user.role === "PARENT" && user.isActive);
    if (!activeUsers.length) {
      skipped.push({ targetType: "GUARDIAN", targetReferenceKey: guardian.id, reasonCode: "NO_ACTIVE_USER", safeContext: { linkedStudentCount: children.length } });
      continue;
    }
    for (const user of activeUsers) {
      if (actionPath && !notificationPathAllowedForRole(actionPath, user.role)) {
        throw new Error("The action path is not safe for the resolved Parent audience.");
      }
      recipients.set(user.id, {
        userId: user.id,
        role: "PARENT",
        contextType: "GUARDIAN_STUDENT",
        context: { targetedChildren: children }
      });
    }
  }
  return {
    recipients: [...recipients.values()],
    skipped,
    summary: {
      audienceType: "SPECIFIC_GUARDIANS",
      academicYear,
      intendedGuardians: guardianIds.length,
      resolvedUsers: recipients.size,
      skipped: skipped.length
    }
  };
}

function dedupe(recipients: ResolvedNotificationRecipient[]) {
  return [...new Map(recipients.map((row) => [row.userId, row])).values()];
}
function classSection(student: { className: string; section: string | null }) {
  return `${student.className}${student.section ? `-${student.section}` : ""}`;
}
function required(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}
function optional(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}
