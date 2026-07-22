import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";
import {
  approveNotificationCampaign,
  createNotificationCampaign,
  publishOrScheduleNotificationCampaign,
  submitNotificationCampaign
} from "../lib/notification-campaigns";
import { resolveNotificationAudience } from "../lib/notification-audiences";
import { buildNotificationReport, notificationReportCsv, notificationReportFilename } from "../lib/notification-reports";

const MARKER = "QA19A";
const PREFIX = "qa19a-";
const YEAR = "2026-27";
const CLASS_NAME = "QA19A-10";
const PASSWORD = "Qa19aNotify@2026";

async function notificationIds() {
  const templateIds = (await prisma.notificationTemplate.findMany({
    where: { OR: [{ templateCode: { startsWith: MARKER } }, { name: { startsWith: MARKER } }] },
    select: { id: true }
  })).map((row) => row.id);
  const campaignIds = (await prisma.notificationCampaign.findMany({
    where: { OR: [{ campaignNumber: { startsWith: MARKER } }, { title: { contains: MARKER } }] },
    select: { id: true }
  })).map((row) => row.id);
  const recipientIds = (await prisma.notificationRecipient.findMany({
    where: { campaignId: { in: campaignIds } },
    select: { id: true }
  })).map((row) => row.id);
  return { templateIds, campaignIds, recipientIds };
}

async function cleanup() {
  const { templateIds, campaignIds, recipientIds } = await notificationIds();
  await prisma.notificationEvent.deleteMany({
    where: {
      OR: [
        { templateId: { in: templateIds } },
        { campaignId: { in: campaignIds } },
        { recipientId: { in: recipientIds } }
      ]
    }
  });
  await prisma.notificationSkippedRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await prisma.notificationRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await prisma.notificationCampaign.updateMany({
    where: { id: { in: campaignIds } },
    data: { correctionOfCampaignId: null }
  });
  await prisma.notificationCampaign.deleteMany({ where: { id: { in: campaignIds } } });
  await prisma.notificationTemplate.deleteMany({ where: { id: { in: templateIds } } });

  await prisma.notice.deleteMany({ where: { title: { startsWith: MARKER } } });
  await prisma.timetableAssignment.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.staffMember.updateMany({
    where: { id: { startsWith: PREFIX } },
    data: { timetableTeacherId: null }
  });
  await prisma.staffMember.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableTeacher.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableSubject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableClassSection.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.studentLifecycleEvent.deleteMany({ where: { studentId: { startsWith: PREFIX } } });
  await prisma.academicYearEnrollment.deleteMany({ where: { studentId: { startsWith: PREFIX } } });
  await prisma.studentGuardian.deleteMany({
    where: { OR: [{ studentId: { startsWith: PREFIX } }, { guardianId: { startsWith: PREFIX } }] }
  });
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await prisma.guardian.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.student.deleteMany({ where: { admissionNo: { startsWith: `${MARKER}-` } } });
}

async function setup() {
  await cleanup();
  const passwordHash = await hashPassword(PASSWORD);
  const leadershipRoles = ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "VIEWER", "ACCOUNTANT"] as const;
  for (const role of leadershipRoles) {
    await prisma.user.create({
      data: {
        id: `${PREFIX}user-${role.toLowerCase().replace("_", "-")}`,
        name: `${MARKER} ${role.replace("_", " ")}`,
        username: `${PREFIX}${role.toLowerCase().replace("_", "-")}`,
        passwordHash,
        role
      }
    });
  }

  const teacher = await prisma.user.create({
    data: { id: `${PREFIX}user-teacher`, name: `${MARKER} Teacher`, username: `${PREFIX}teacher`, passwordHash, role: "TEACHER" }
  });
  const peerTeacher = await prisma.user.create({
    data: { id: `${PREFIX}user-teacher-peer`, name: `${MARKER} Peer Teacher`, username: `${PREFIX}teacher-peer`, passwordHash, role: "TEACHER" }
  });
  await prisma.user.create({
    data: { id: `${PREFIX}user-teacher-unlinked`, name: `${MARKER} Unlinked Teacher`, username: `${PREFIX}teacher-unlinked`, passwordHash, role: "TEACHER" }
  });

  const linkedGuardian = await prisma.guardian.create({
    data: { id: `${PREFIX}guardian-linked`, displayName: `${MARKER} Linked Guardian`, relationship: "Parent", primaryMobile: "9000001911" }
  });
  const unrelatedGuardian = await prisma.guardian.create({
    data: { id: `${PREFIX}guardian-unrelated`, displayName: `${MARKER} Unrelated Guardian`, relationship: "Parent", primaryMobile: "9000001912" }
  });
  const noUserGuardian = await prisma.guardian.create({
    data: { id: `${PREFIX}guardian-no-user`, displayName: `${MARKER} Guardian Without User`, relationship: "Parent", primaryMobile: "9000001913" }
  });
  await prisma.user.createMany({
    data: [
      { id: `${PREFIX}user-parent`, name: `${MARKER} Linked Parent`, username: `${PREFIX}parent`, passwordHash, role: "PARENT", guardianId: linkedGuardian.id },
      { id: `${PREFIX}user-parent-unrelated`, name: `${MARKER} Unrelated Parent`, username: `${PREFIX}parent-unrelated`, passwordHash, role: "PARENT", guardianId: unrelatedGuardian.id }
    ]
  });

  const students = await Promise.all([
    prisma.student.create({
      data: { id: `${PREFIX}student-one`, admissionNo: `${MARKER}-STU-001`, studentName: `${MARKER} Child One`, fatherName: `${MARKER} Guardian`, className: CLASS_NAME, section: "A", phone1: "9000001921", status: "Active" }
    }),
    prisma.student.create({
      data: { id: `${PREFIX}student-sibling`, admissionNo: `${MARKER}-STU-002`, studentName: `${MARKER} Child Sibling`, fatherName: `${MARKER} Guardian`, className: CLASS_NAME, section: "A", phone1: "9000001922", status: "Active" }
    }),
    prisma.student.create({
      data: { id: `${PREFIX}student-no-user`, admissionNo: `${MARKER}-STU-003`, studentName: `${MARKER} Child No User`, fatherName: `${MARKER} Guardian`, className: CLASS_NAME, section: "A", phone1: "9000001923", status: "Active" }
    }),
    prisma.student.create({
      data: { id: `${PREFIX}student-unrelated`, admissionNo: `${MARKER}-STU-004`, studentName: `${MARKER} Unrelated Child`, fatherName: `${MARKER} Guardian`, className: CLASS_NAME, section: "B", phone1: "9000001924", status: "Active" }
    })
  ]);
  await prisma.studentGuardian.createMany({
    data: [
      { id: `${PREFIX}link-one`, studentId: students[0].id, guardianId: linkedGuardian.id, relationshipToStudent: "Parent", isPrimaryContact: true },
      { id: `${PREFIX}link-sibling`, studentId: students[1].id, guardianId: linkedGuardian.id, relationshipToStudent: "Parent", isPrimaryContact: true },
      { id: `${PREFIX}link-no-user`, studentId: students[2].id, guardianId: noUserGuardian.id, relationshipToStudent: "Parent", isPrimaryContact: true },
      { id: `${PREFIX}link-unrelated`, studentId: students[3].id, guardianId: unrelatedGuardian.id, relationshipToStudent: "Parent", isPrimaryContact: true }
    ]
  });
  await prisma.academicYearEnrollment.createMany({
    data: students.map((student, index) => ({
      id: `${PREFIX}enrollment-${index + 1}`,
      studentId: student.id,
      academicYear: YEAR,
      className: CLASS_NAME,
      section: index === 3 ? "B" : "A",
      status: "ACTIVE",
      enrollmentDate: new Date("2026-06-01T00:00:00.000Z")
    }))
  });

  const classA = await prisma.timetableClassSection.create({
    data: { id: `${PREFIX}class-a`, academicYear: YEAR, className: CLASS_NAME, section: "A", displayName: `${MARKER} 10-A`, groupName: `${MARKER} SENIOR` }
  });
  const classB = await prisma.timetableClassSection.create({
    data: { id: `${PREFIX}class-b`, academicYear: YEAR, className: CLASS_NAME, section: "B", displayName: `${MARKER} 10-B`, groupName: `${MARKER} SENIOR` }
  });
  const math = await prisma.timetableSubject.create({
    data: { id: `${PREFIX}subject-math`, name: `${MARKER} Mathematics`, shortName: `${MARKER}-MATH`, department: "Academics" }
  });
  const science = await prisma.timetableSubject.create({
    data: { id: `${PREFIX}subject-science`, name: `${MARKER} Science`, shortName: `${MARKER}-SCI`, department: "Academics" }
  });
  const timetableTeacher = await prisma.timetableTeacher.create({
    data: { id: `${PREFIX}timetable-teacher`, name: `${MARKER} Teacher`, shortName: `${MARKER}-T1`, maxPeriodsPerWeek: 30 }
  });
  const peerTimetableTeacher = await prisma.timetableTeacher.create({
    data: { id: `${PREFIX}timetable-peer`, name: `${MARKER} Peer Teacher`, shortName: `${MARKER}-T2`, maxPeriodsPerWeek: 30 }
  });
  await prisma.staffMember.createMany({
    data: [
      { id: `${PREFIX}staff-teacher`, staffCode: `${MARKER}-STAFF-001`, fullName: `${MARKER} Teacher`, designation: "Teacher", department: "Academics", primarySubject: "Mathematics", status: "ACTIVE", userId: teacher.id, timetableTeacherId: timetableTeacher.id },
      { id: `${PREFIX}staff-peer`, staffCode: `${MARKER}-STAFF-002`, fullName: `${MARKER} Peer Teacher`, designation: "Teacher", department: "Academics", primarySubject: "Science", status: "ACTIVE", userId: peerTeacher.id, timetableTeacherId: peerTimetableTeacher.id }
    ]
  });
  await prisma.timetableAssignment.createMany({
    data: [
      { id: `${PREFIX}assignment-math`, academicYear: YEAR, classSectionId: classA.id, subjectId: math.id, teacherId: timetableTeacher.id, periodsPerWeek: 5 },
      { id: `${PREFIX}assignment-science`, academicYear: YEAR, classSectionId: classB.id, subjectId: science.id, teacherId: peerTimetableTeacher.id, periodsPerWeek: 5 }
    ]
  });
  await prisma.notice.create({
    data: {
      id: `${PREFIX}legacy-notice`,
      title: `${MARKER} Legacy Parent Notice`,
      body: `${MARKER} existing Notice adapter verification.`,
      audienceType: "ALL_PARENTS",
      status: "PUBLISHED",
      publishDate: new Date("2026-07-17T00:00:00.000Z"),
      createdById: `${PREFIX}user-director`
    }
  });

  console.log(JSON.stringify({
    marker: MARKER,
    password: PASSWORD,
    academicYear: YEAR,
    className: CLASS_NAME,
    section: "A",
    teacherSubjectId: math.id,
    usernames: [
      ...leadershipRoles.map((role) => `${PREFIX}${role.toLowerCase().replace("_", "-")}`),
      `${PREFIX}teacher`,
      `${PREFIX}teacher-peer`,
      `${PREFIX}teacher-unlinked`,
      `${PREFIX}parent`,
      `${PREFIX}parent-unrelated`
    ]
  }, null, 2));
}

async function inspect() {
  const { templateIds, campaignIds, recipientIds } = await notificationIds();
  console.log(JSON.stringify({
    notificationTemplates: templateIds.length,
    notificationCampaigns: campaignIds.length,
    campaignLinks: await prisma.notificationCampaign.findMany({
      where: { id: { in: campaignIds } },
      select: { campaignNumber: true, templateId: true, correctionOfCampaignId: true }
    }),
    notificationRecipients: recipientIds.length,
    notificationSkippedRecipients: await prisma.notificationSkippedRecipient.count({ where: { campaignId: { in: campaignIds } } }),
    notificationEvents: await prisma.notificationEvent.count({
      where: { OR: [{ templateId: { in: templateIds } }, { campaignId: { in: campaignIds } }, { recipientId: { in: recipientIds } }] }
    }),
    legacyNotices: await prisma.notice.count({ where: { title: { startsWith: MARKER } } }),
    users: await prisma.user.count({ where: { username: { startsWith: PREFIX } } }),
    guardians: await prisma.guardian.count({ where: { id: { startsWith: PREFIX } } }),
    students: await prisma.student.count({ where: { admissionNo: { startsWith: `${MARKER}-` } } }),
    guardianStudentLinks: await prisma.studentGuardian.count({ where: { OR: [{ studentId: { startsWith: PREFIX } }, { guardianId: { startsWith: PREFIX } }] } }),
    enrollments: await prisma.academicYearEnrollment.count({ where: { studentId: { startsWith: PREFIX } } }),
    staffMembers: await prisma.staffMember.count({ where: { id: { startsWith: PREFIX } } }),
    timetableTeachers: await prisma.timetableTeacher.count({ where: { id: { startsWith: PREFIX } } }),
    timetableSubjects: await prisma.timetableSubject.count({ where: { id: { startsWith: PREFIX } } }),
    timetableClassSections: await prisma.timetableClassSection.count({ where: { id: { startsWith: PREFIX } } }),
    timetableAssignments: await prisma.timetableAssignment.count({ where: { id: { startsWith: PREFIX } } }),
    lifecycleEvents: await prisma.studentLifecycleEvent.count({ where: { studentId: { startsWith: PREFIX } } }),
    sourceTotals: {
      students: await prisma.student.count(),
      enrollments: await prisma.academicYearEnrollment.count(),
      staffMembers: await prisma.staffMember.count(),
      payments: await prisma.payment.count(),
      expenses: await prisma.expenseRecord.count(),
      miscIncome: await prisma.miscIncomeReceipt.count(),
      users: await prisma.user.count(),
      guardians: await prisma.guardian.count()
    }
  }, null, 2));
}

async function scheduleQaCampaign(campaignId: string, indiaLocalIso: string) {
  const campaign = await prisma.notificationCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !campaign.title.startsWith(MARKER) || campaign.status !== "APPROVED") {
    throw new Error("Only an approved QA19A campaign can use the schedule fallback.");
  }
  const actor = await prisma.user.findUniqueOrThrow({
    where: { username: `${PREFIX}director` },
    select: { id: true, name: true, username: true, role: true }
  });
  const scheduledFor = new Date(`${indiaLocalIso}:00+05:30`);
  const result = await publishOrScheduleNotificationCampaign(
    prisma,
    campaignId,
    actor as never,
    "schedule",
    scheduledFor
  );
  console.log(JSON.stringify({
    campaignNumber: result.campaignNumber,
    status: result.status,
    scheduledFor: result.scheduledFor,
    totalRecipientRows: result.totalRecipientRows,
    totalSkipped: result.totalSkipped
  }, null, 2));
}

async function inspectAudienceMatrix() {
  const director = await prisma.user.findUniqueOrThrow({
    where: { username: `${PREFIX}director` },
    select: { id: true, role: true }
  });
  const teacher = await prisma.user.findUniqueOrThrow({
    where: { username: `${PREFIX}teacher` },
    select: { id: true, role: true }
  });
  const before = {
    recipients: await prisma.notificationRecipient.count(),
    skipped: await prisma.notificationSkippedRecipient.count(),
    events: await prisma.notificationEvent.count()
  };
  const cases = [
    ["ALL_PARENTS", {}, director],
    ["ALL_TEACHERS", {}, director],
    ["ALL_STAFF", {}, director],
    ["ROLE", { role: "PARENT" }, director],
    ["CLASS", { academicYear: YEAR, className: CLASS_NAME }, director],
    ["CLASS_SECTION", { academicYear: YEAR, className: CLASS_NAME, section: "A" }, director],
    ["SPECIFIC_STUDENTS", { academicYear: YEAR, studentIds: [`${PREFIX}student-one`, `${PREFIX}student-sibling`, `${PREFIX}student-no-user`] }, director],
    ["SPECIFIC_GUARDIANS", { guardianIds: [`${PREFIX}guardian-linked`, `${PREFIX}guardian-no-user`] }, director],
    ["SPECIFIC_STAFF", { staffIds: [`${PREFIX}staff-teacher`, `${PREFIX}staff-peer`] }, director],
    ["SPECIFIC_USERS", { userIds: [`${PREFIX}user-parent`, `${PREFIX}user-teacher`, `${PREFIX}user-viewer`] }, director],
    ["TEACHER_TIMETABLE_SCOPE", { academicYear: YEAR, className: CLASS_NAME, section: "A", subjectId: `${PREFIX}subject-math` }, teacher]
  ] as const;
  const results = [];
  for (const [audienceType, definition, actor] of cases) {
    const resolution = await resolveNotificationAudience(prisma, {
      audienceType,
      definition,
      actor: actor as never,
      actionPath: audienceType === "TEACHER_TIMETABLE_SCOPE" ? "/parent/homework" : null
    });
    results.push({
      audienceType,
      recipientUsers: resolution.recipients.map((row) => row.userId),
      contexts: resolution.recipients.map((row) => row.context),
      skippedReasons: resolution.skipped.reduce<Record<string, number>>((counts, row) => {
        counts[row.reasonCode] = (counts[row.reasonCode] ?? 0) + 1;
        return counts;
      }, {}),
      summary: resolution.summary
    });
  }
  const after = {
    recipients: await prisma.notificationRecipient.count(),
    skipped: await prisma.notificationSkippedRecipient.count(),
    events: await prisma.notificationEvent.count()
  };
  console.log(JSON.stringify({ before, after, previewWroteNothing: JSON.stringify(before) === JSON.stringify(after), results }, null, 2));
}

async function createTimedCampaign(mode: "schedule" | "publish", delaySeconds: number, lifetimeSeconds: number) {
  if (!Number.isInteger(delaySeconds) || delaySeconds < 0 || delaySeconds > 600) throw new Error("Delay must be between 0 and 600 seconds.");
  if (!Number.isInteger(lifetimeSeconds) || lifetimeSeconds < 10 || lifetimeSeconds > 600) throw new Error("Lifetime must be between 10 and 600 seconds.");
  const actor = await prisma.user.findUniqueOrThrow({
    where: { username: `${PREFIX}director` },
    select: { id: true, name: true, username: true, email: true, guardianId: true, role: true }
  });
  const now = new Date();
  const availableAt = new Date(now.getTime() + delaySeconds * 1_000);
  const expiresAt = new Date(availableAt.getTime() + lifetimeSeconds * 1_000);
  const campaign = await createNotificationCampaign(prisma, {
    category: "GENERAL",
    priority: "IMPORTANT",
    title: `${MARKER} ${mode === "schedule" ? "Scheduled restart" : "Expiry history"} ${now.toISOString()}`,
    body: `${MARKER} deterministic ${mode} visibility fixture.`,
    audienceType: "CLASS_SECTION",
    audienceDefinition: { academicYear: YEAR, className: CLASS_NAME, section: "A" },
    acknowledgmentRequired: false,
    expiresAt
  }, actor as never);
  await submitNotificationCampaign(prisma, campaign.id, actor as never);
  await approveNotificationCampaign(prisma, campaign.id, actor as never);
  const result = await publishOrScheduleNotificationCampaign(
    prisma,
    campaign.id,
    actor as never,
    mode,
    mode === "schedule" ? availableAt : null
  );
  console.log(JSON.stringify({
    id: result.id,
    campaignNumber: result.campaignNumber,
    status: result.status,
    title: result.title,
    availableAt: mode === "schedule" ? availableAt : result.publishedAt,
    expiresAt,
    totalRecipientRows: result.totalRecipientRows,
    totalSkipped: result.totalSkipped
  }, null, 2));
}

async function inspectReport() {
  const report = await buildNotificationReport(prisma);
  const csv = notificationReportCsv(report);
  console.log(JSON.stringify({
    totals: report.totals,
    byStatus: report.byStatus,
    byCategory: report.byCategory,
    byPriority: report.byPriority,
    byAudienceType: report.byAudienceType,
    skippedReasons: report.skippedReasons,
    filename: notificationReportFilename(),
    csvHeader: csv.split(/\r?\n/, 1)[0],
    csvFormulaProtected: !/^[=+\-@]/m.test(csv),
    csvContainsContactFields: /phone|email|guardian contact|student name|actor id/i.test(csv)
  }, null, 2));
}

async function main() {
  const action = process.argv[2];
  if (action === "setup") await setup();
  else if (action === "cleanup") {
    await cleanup();
    await inspect();
  } else if (action === "inspect") await inspect();
  else if (action === "schedule") await scheduleQaCampaign(String(process.argv[3] ?? ""), String(process.argv[4] ?? ""));
  else if (action === "audiences") await inspectAudienceMatrix();
  else if (action === "report") await inspectReport();
  else if (action === "timed") {
    const mode = String(process.argv[3] ?? "") as "schedule" | "publish";
    if (!["schedule", "publish"].includes(mode)) throw new Error("Timed mode must be schedule or publish.");
    await createTimedCampaign(mode, Number(process.argv[4] ?? 0), Number(process.argv[5] ?? 60));
  } else throw new Error("Use: pnpm.cmd exec tsx scripts/qa19a-fixtures.ts setup|cleanup|inspect|audiences|report|schedule <campaignId> <YYYY-MM-DDTHH:mm>|timed <schedule|publish> <delaySeconds> <lifetimeSeconds>");
}

main().finally(() => prisma.$disconnect());
