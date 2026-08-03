import { createHash } from "node:crypto";

export type ClassworkNotificationRecipient = { id: string; role: string };

export async function publishClassworkNotification(client: any, input: {
  eventKey: string;
  eventType: "PUBLISHED" | "SUBMITTED" | "RETURNED" | "REVIEWED";
  itemPublicKey: string;
  itemKind: string;
  actorUserId: string;
  recipients: ClassworkNotificationRecipient[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const fingerprint = createHash("sha256").update(`CLASS23F|${input.eventType}|${input.eventKey}`).digest("hex").slice(0, 24).toUpperCase();
  const campaignNumber = `CLASS23F-${input.eventType}-${fingerprint}`;
  const existing = await client.notificationCampaign.findUnique({ where: { campaignNumber }, select: { campaignNumber: true, totalRecipientRows: true } });
  if (existing) return { campaignNumber, recipients: existing.totalRecipientRows, idempotent: true };
  const recipients = [...new Map(input.recipients.map((row) => [row.id, row])).values()].slice(0, 500);
  const copy = notificationCopy(input.eventType, input.itemKind);
  let campaign: { id: string };
  try {
    campaign = await client.notificationCampaign.create({ data: {
      campaignNumber,
      category: "ACADEMIC",
      priority: input.eventType === "RETURNED" ? "HIGH" : "NORMAL",
      title: copy.title,
      body: copy.body,
      actionLabel: copy.actionLabel,
      actionPath: copy.actionPath,
      audienceType: "SPECIFIC_USERS",
      audienceDefinitionJson: JSON.stringify({ eventType: input.eventType, governedClasswork: true }),
      audienceSnapshotJson: JSON.stringify({ resolvedUsers: recipients.length, resolvedAt: now.toISOString(), channel: "IN_APP" }),
      channel: "IN_APP",
      status: "PUBLISHED",
      acknowledgmentRequired: false,
      totalResolvedUsers: recipients.length,
      totalRecipientRows: recipients.length,
      totalSkipped: recipients.length ? 0 : 1,
      createdByUserId: input.actorUserId,
      submittedByUserId: input.actorUserId,
      approvedByUserId: input.actorUserId,
      publishedByUserId: input.actorUserId,
      submittedAt: now,
      approvedAt: now,
      publishedAt: now
    } });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const raced = await client.notificationCampaign.findUnique({ where: { campaignNumber }, select: { totalRecipientRows: true } });
    if (!raced) throw error;
    return { campaignNumber, recipients: raced.totalRecipientRows, idempotent: true };
  }
  for (const recipient of recipients) {
    await client.notificationRecipient.create({ data: {
      campaignId: campaign.id,
      userId: recipient.id,
      recipientRoleSnapshot: recipient.role,
      contextType: "CLASSWORK_PRIVATE",
      recipientContextJson: JSON.stringify({ classworkReference: input.itemPublicKey, eventReference: fingerprint }),
      deliveryStatus: "AVAILABLE",
      availableAt: now
    } });
  }
  if (!recipients.length) await client.notificationSkippedRecipient.create({ data: {
    campaignId: campaign.id,
    targetType: "CLASSWORK_SCOPE",
    targetReferenceKey: fingerprint,
    reasonCode: "NO_ACTIVE_SCOPED_USER",
    safeContextJson: JSON.stringify({ eventType: input.eventType })
  } });
  await client.notificationEvent.create({ data: {
    campaignId: campaign.id,
    eventType: `CLASSWORK_${input.eventType}_NOTIFIED`,
    newStatus: "PUBLISHED",
    reason: recipients.length ? `Resolved ${recipients.length} active scoped recipient(s).` : "No active scoped recipient was available.",
    recordedByUserId: input.actorUserId,
    eventDate: now
  } });
  return { campaignNumber, recipients: recipients.length, idempotent: false };
}

export async function resolvePublishedClassworkRecipients(client: any, item: { academicYear: string; className: string; section: string }) {
  const now = new Date();
  return client.user.findMany({
    where: {
      isActive: true,
      lifecycleStatus: "ACTIVE",
      iamRoleAssignments: { some: { role: { in: ["PARENT", "STUDENT"] }, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } },
      OR: [
        { guardian: { status: "Active", students: { some: { student: { deletedAt: null, academicYearEnrollments: { some: { academicYear: item.academicYear, className: item.className, section: item.section, status: "ACTIVE" } } } } } } },
        { authLoginAliases: { some: { type: "ADMISSION_NUMBER", status: "VERIFIED", isSchoolGoverned: true, admissionStudent: { deletedAt: null, academicYearEnrollments: { some: { academicYear: item.academicYear, className: item.className, section: item.section, status: "ACTIVE" } } } } } }
      ]
    },
    select: { id: true, role: true },
    orderBy: { id: "asc" },
    take: 500
  });
}

export async function resolveSubmissionTeacherRecipients(client: any, item: { academicYear: string; className: string; section: string; timetableSubjectId: string; createdByUserId: string }) {
  const now = new Date();
  const teachers = await client.user.findMany({
    where: {
      isActive: true,
      lifecycleStatus: "ACTIVE",
      iamRoleAssignments: { some: { role: "TEACHER", status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } },
      staffMember: { status: "ACTIVE", timetableTeacher: { isActive: true, assignments: { some: { academicYear: item.academicYear, subjectId: item.timetableSubjectId, classSection: { academicYear: item.academicYear, className: item.className, section: item.section, isActive: true } } } } }
    },
    select: { id: true, role: true },
    orderBy: { id: "asc" },
    take: 100
  });
  const creator = await client.user.findFirst({ where: { id: item.createdByUserId, isActive: true, lifecycleStatus: "ACTIVE" }, select: { id: true, role: true } });
  return creator ? [...teachers, creator] : teachers;
}

function notificationCopy(eventType: string, kind: string) {
  const label = kind.toLowerCase().replaceAll("_", " ");
  if (eventType === "PUBLISHED") return { title: `New ${label} published`, body: "New instructions are available in your private classwork workspace.", actionLabel: "Open Classwork", actionPath: "/my-classwork" };
  if (eventType === "SUBMITTED") return { title: "Classwork submitted", body: "A scoped Student submission is ready in the private Teacher queue.", actionLabel: "Open Submission Queue", actionPath: "/teacher/classwork" };
  if (eventType === "RETURNED") return { title: "Classwork returned for revision", body: "Teacher feedback is available in your private classwork workspace.", actionLabel: "Open Feedback", actionPath: "/my-classwork" };
  return { title: "Classwork reviewed", body: "Teacher review feedback is available in your private classwork workspace.", actionLabel: "Open Feedback", actionPath: "/my-classwork" };
}

function isUniqueConflict(error: unknown) { return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002"); }
