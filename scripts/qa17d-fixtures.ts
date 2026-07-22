import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import {
  createEmptyKgDraft,
  KG_ATTENDANCE_MONTHS,
  KG_CRITERIA,
  KG_EVALUATIONS,
  KG_GROWTH_PERIODS,
  KG_PERSONALITY_TRAITS,
  KG_RESPONSE_SETS,
  KG_SUMMARY_AREAS
} from "../lib/kg-report-card";
import { DEFAULT_KG_TEMPLATE, DEFAULT_MARK_TEMPLATE } from "../lib/report-card-templates";

const PREFIX = "QA17D";
const ACADEMIC_YEAR = "2026-27";
const PASSWORD = "Qa17dTeacher@2026";

async function cleanup() {
  const cycles = await prisma.teacherAnalyticsReviewCycle.findMany({
    where: { cycleCode: { startsWith: PREFIX } },
    select: { id: true }
  });
  const cycleIds = cycles.map((cycle) => cycle.id);
  const snapshots = await prisma.teacherAnalyticsSnapshot.findMany({
    where: { reviewCycleId: { in: cycleIds } },
    select: { id: true }
  });
  const snapshotIds = snapshots.map((snapshot) => snapshot.id);
  const reviews = await prisma.teacherAnalyticsReview.findMany({
    where: { snapshotId: { in: snapshotIds } },
    select: { id: true }
  });
  await prisma.teacherAnalyticsEvent.deleteMany({ where: { reviewCycleId: { in: cycleIds } } });
  await prisma.teacherAnalyticsReview.deleteMany({ where: { id: { in: reviews.map((review) => review.id) } } });
  await prisma.teacherAnalyticsSnapshot.deleteMany({ where: { id: { in: snapshotIds } } });
  await prisma.teacherAnalyticsReviewCycle.deleteMany({ where: { id: { in: cycleIds } } });

  await prisma.homeworkAssignmentEvent.deleteMany({ where: { assignment: { assignmentNumber: { startsWith: PREFIX } } } });
  await prisma.homeworkAssignment.deleteMany({ where: { assignmentNumber: { startsWith: PREFIX } } });
  await prisma.studentReportCardEvent.deleteMany({ where: { reportCard: { reportCardNumber: { startsWith: PREFIX } } } });
  await prisma.studentReportCardVersion.deleteMany({ where: { reportCard: { reportCardNumber: { startsWith: PREFIX } } } });
  await prisma.studentReportCard.deleteMany({ where: { reportCardNumber: { startsWith: PREFIX } } });
  await prisma.reportCardBatchExamSource.deleteMany({ where: { batch: { batchNumber: { startsWith: PREFIX } } } });
  await prisma.reportCardBatch.deleteMany({ where: { batchNumber: { startsWith: PREFIX } } });
  await prisma.reportCardTemplate.deleteMany({ where: { templateCode: { startsWith: PREFIX } } });
  await prisma.gradeBand.deleteMany({ where: { gradingScheme: { schemeCode: { startsWith: PREFIX } } } });
  await prisma.gradingScheme.deleteMany({ where: { schemeCode: { startsWith: PREFIX } } });
  await prisma.studentMarkEvent.deleteMany({ where: { assessment: { examCycle: { examCode: { startsWith: PREFIX } } } } });
  await prisma.studentMark.deleteMany({ where: { assessment: { examCycle: { examCode: { startsWith: PREFIX } } } } });
  await prisma.examAssessment.deleteMany({ where: { examCycle: { examCode: { startsWith: PREFIX } } } });
  await prisma.examCycle.deleteMany({ where: { examCode: { startsWith: PREFIX } } });
  await prisma.substituteAssignment.deleteMany({ where: { notes: { startsWith: PREFIX } } });
  await prisma.staffLeaveRequest.deleteMany({ where: { notes: { startsWith: PREFIX } } });
  await prisma.staffAttendanceSession.deleteMany({ where: { notes: { startsWith: PREFIX } } });
  await prisma.academicYearEnrollment.deleteMany({ where: { student: { admissionNo: { startsWith: PREFIX } } } });
  await prisma.student.deleteMany({ where: { admissionNo: { startsWith: PREFIX } } });
  await prisma.timetableEntry.deleteMany({ where: { draft: { name: { startsWith: PREFIX } } } });
  await prisma.timetableDraft.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.timetableAssignment.deleteMany({ where: { notes: { startsWith: PREFIX } } });
  await prisma.staffMember.deleteMany({ where: { staffCode: { startsWith: PREFIX } } });
  await prisma.timetableTeacher.deleteMany({ where: { shortName: { startsWith: PREFIX } } });
  await prisma.timetableClassSection.deleteMany({ where: { displayName: { startsWith: PREFIX } } });
  await prisma.timetableSubject.deleteMany({ where: { shortName: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: "qa17d-" } } });
}

async function setup() {
  await cleanup();
  const director = await prisma.user.findUniqueOrThrow({ where: { username: "director" } });
  const passwordHash = await hashPassword(PASSWORD);
  const teacherUsers = await Promise.all([
    prisma.user.create({ data: { id: "qa17d-user-a", name: "QA17D Teacher A", username: "qa17d-teacher-a", passwordHash, role: "TEACHER" } }),
    prisma.user.create({ data: { id: "qa17d-user-b", name: "QA17D Teacher B", username: "qa17d-teacher-b", passwordHash, role: "TEACHER" } }),
    prisma.user.create({ data: { id: "qa17d-user-c", name: "QA17D Teacher C Missing Sources", username: "qa17d-teacher-c", passwordHash, role: "TEACHER" } })
  ]);
  await Promise.all([
    prisma.user.create({ data: { id: "qa17d-user-principal", name: "QA17D Principal", username: "qa17d-principal", passwordHash, role: "PRINCIPAL" } }),
    prisma.user.create({ data: { id: "qa17d-user-parent", name: "QA17D Parent", username: "qa17d-parent", passwordHash, role: "PARENT" } })
  ]);
  const subject = await prisma.timetableSubject.create({
    data: { id: "qa17d-subject-math", name: "QA17D Mathematics", shortName: "QA17D-MATH", department: "QA17D", isActive: true }
  });
  const sections = await Promise.all(["A", "B"].map((section) => prisma.timetableClassSection.create({
    data: { id: `qa17d-section-${section.toLowerCase()}`, academicYear: ACADEMIC_YEAR, className: "QA17D Grade 5", section, displayName: `QA17D Grade 5-${section}`, groupName: "QA17D Primary" }
  })));
  const timetableTeachers = await Promise.all(["A", "B"].map((suffix, index) => prisma.timetableTeacher.create({
    data: { id: `qa17d-timetable-teacher-${suffix.toLowerCase()}`, name: `QA17D Teacher ${suffix}`, shortName: `QA17D-T${suffix}`, department: "QA17D", maxPeriodsPerWeek: 35, maxPeriodsPerDay: 7 }
  })));
  const staff = await Promise.all(["A", "B", "C"].map((suffix, index) => prisma.staffMember.create({
    data: {
      id: `qa17d-staff-${suffix.toLowerCase()}`,
      staffCode: `QA17D-ST-${suffix}`,
      fullName: `QA17D Teacher ${suffix}`,
      displayName: `QA17D Teacher ${suffix}`,
      staffType: "TEACHING",
      designation: "Teacher",
      department: "QA17D",
      primarySubject: subject.name,
      status: "ACTIVE",
      userId: teacherUsers[index].id,
      timetableTeacherId: timetableTeachers[index]?.id
    }
  })));
  const assignments = await Promise.all(sections.map((section, index) => prisma.timetableAssignment.create({
    data: {
      id: `qa17d-assignment-${index + 1}`,
      academicYear: ACADEMIC_YEAR,
      classSectionId: section.id,
      subjectId: subject.id,
      teacherId: timetableTeachers[index].id,
      periodsPerWeek: index === 0 ? 6 : 4,
      notes: `${PREFIX} isolated Browser QA`
    }
  })));
  await prisma.timetableDraft.create({
    data: { id: "qa17d-active-draft", academicYear: ACADEMIC_YEAR, name: "QA17D Active Timetable", status: "ACTIVE", createdByUserId: director.id }
  });

  const students: Array<{ id: string; section: string }> = [];
  for (const section of ["A", "B"]) {
    for (let number = 1; number <= 6; number++) {
      const admissionNo = `${PREFIX}-${section}-${String(number).padStart(2, "0")}`;
      const student = await prisma.student.create({
        data: {
          id: `qa17d-student-${section.toLowerCase()}-${number}`,
          academicYear: ACADEMIC_YEAR,
          admissionNo,
          studentName: `${PREFIX} Student ${section}${number}`,
          fatherName: `${PREFIX} Guardian`,
          className: "QA17D Grade 5",
          section,
          phone1: `900000${section === "A" ? "1" : "2"}${String(number).padStart(3, "0")}`,
          status: "Active"
        }
      });
      await prisma.academicYearEnrollment.create({
        data: { studentId: student.id, academicYear: ACADEMIC_YEAR, className: "QA17D Grade 5", section, status: "ACTIVE", enrollmentDate: new Date("2026-06-01T00:00:00+05:30") }
      });
      students.push({ id: student.id, section });
    }
  }

  for (const [index, date] of ["2026-07-01", "2026-07-02", "2026-07-03"].entries()) {
    await prisma.staffAttendanceSession.create({
      data: {
        id: `qa17d-attendance-${index + 1}`,
        attendanceDate: new Date(`${date}T00:00:00+05:30`),
        academicYear: ACADEMIC_YEAR,
        status: "LOCKED",
        takenByUserId: director.id,
        lockedByUserId: director.id,
        lockedAt: new Date(`${date}T15:00:00+05:30`),
        notes: `${PREFIX} Browser QA`,
        records: {
          create: staff.map((member, staffIndex) => ({
            staffMemberId: member.id,
            staffCode: member.staffCode,
            status: index === 2 && staffIndex === 0 ? "ON_LEAVE" : "PRESENT",
            source: "MANUAL",
            lateMinutes: index === 1 && staffIndex === 1 ? 8 : 0
          }))
        }
      }
    });
  }
  await prisma.staffLeaveRequest.create({
    data: {
      id: "qa17d-approved-leave-a",
      staffMemberId: staff[0].id,
      requestedByUserId: teacherUsers[0].id,
      leaveType: "CASUAL",
      startDate: new Date("2026-07-03T00:00:00+05:30"),
      endDate: new Date("2026-07-03T23:59:59+05:30"),
      totalDays: 1,
      reason: "Private reason excluded from analytics",
      status: "APPROVED",
      approverUserId: director.id,
      approvedAt: new Date("2026-07-01T10:00:00+05:30"),
      notes: `${PREFIX} Browser QA`
    }
  });
  await prisma.staffLeaveRequest.create({
    data: {
      id: "qa17d-pending-leave-b",
      staffMemberId: staff[1].id,
      requestedByUserId: teacherUsers[1].id,
      leaveType: "SICK",
      startDate: new Date("2026-07-08T00:00:00+05:30"),
      endDate: new Date("2026-07-08T23:59:59+05:30"),
      totalDays: 1,
      reason: "QA private medical detail must never appear in analytics",
      status: "PENDING",
      notes: `${PREFIX} Browser QA pending leave`
    }
  });
  await prisma.substituteAssignment.create({
    data: {
      id: "qa17d-substitute-a-b",
      assignmentDate: new Date("2026-07-03T00:00:00+05:30"),
      academicYear: ACADEMIC_YEAR,
      leaveRequestId: "qa17d-approved-leave-a",
      absentStaffMemberId: staff[0].id,
      substituteStaffMemberId: staff[1].id,
      timetableAssignmentId: assignments[0].id,
      className: "QA17D Grade 5",
      section: "A",
      subject: subject.name,
      periodLabel: "Period 2",
      reason: "APPROVED_LEAVE",
      status: "COMPLETED",
      notes: `${PREFIX} Browser QA substitute context`,
      assignedByUserId: director.id,
      completedByUserId: director.id,
      assignedAt: new Date("2026-07-02T12:00:00+05:30"),
      completedAt: new Date("2026-07-03T12:00:00+05:30")
    }
  });
  await Promise.all(staff.slice(0, 2).map((member, index) => prisma.homeworkAssignment.create({
    data: {
      id: `qa17d-homework-${index + 1}`,
      assignmentNumber: `${PREFIX}-HW-${index + 1}`,
      academicYear: ACADEMIC_YEAR,
      title: `${PREFIX} Context Assignment ${index + 1}`,
      instructions: "Contextual QA assignment without Student-level analytics.",
      className: "QA17D Grade 5",
      section: index === 0 ? "A" : "B",
      subjectName: subject.name,
      timetableSubjectId: subject.id,
      assignedDate: new Date("2026-07-04T09:00:00+05:30"),
      dueDate: new Date("2026-07-06T09:00:00+05:30"),
      status: "PUBLISHED",
      createdByUserId: teacherUsers[index].id,
      publishedByUserId: teacherUsers[index].id,
      publishedAt: new Date("2026-07-04T10:00:00+05:30")
    }
  })));
  await prisma.homeworkAssignment.createMany({
    data: [
      {
        id: "qa17d-homework-draft-a",
        assignmentNumber: `${PREFIX}-HW-DRAFT-A`,
        academicYear: ACADEMIC_YEAR,
        title: `${PREFIX} Draft Context`,
        instructions: "Draft activity context.",
        className: "QA17D Grade 5",
        section: "A",
        subjectName: subject.name,
        timetableSubjectId: subject.id,
        assignedDate: new Date("2026-07-05T09:00:00+05:30"),
        status: "DRAFT",
        createdByUserId: teacherUsers[0].id
      },
      {
        id: "qa17d-homework-cancelled-a",
        assignmentNumber: `${PREFIX}-HW-CANCELLED-A`,
        academicYear: ACADEMIC_YEAR,
        title: `${PREFIX} Cancelled Context`,
        instructions: "Cancelled activity context.",
        className: "QA17D Grade 5",
        section: "A",
        subjectName: subject.name,
        timetableSubjectId: subject.id,
        assignedDate: new Date("2026-07-06T09:00:00+05:30"),
        status: "CANCELLED",
        cancellationReason: "QA scope changed",
        createdByUserId: teacherUsers[0].id,
        cancelledByUserId: teacherUsers[0].id,
        cancelledAt: new Date("2026-07-06T10:00:00+05:30")
      }
    ]
  });
  await prisma.homeworkAssignmentEvent.create({
    data: {
      id: "qa17d-homework-correction-event",
      assignmentId: "qa17d-homework-1",
      eventType: "CORRECTED",
      eventDate: new Date("2026-07-05T12:00:00+05:30"),
      titleSnapshot: `${PREFIX} Context Assignment 1`,
      instructionsSnapshot: "Contextual QA assignment without Student-level analytics.",
      reason: "QA wording correction",
      recordedByUserId: teacherUsers[0].id
    }
  });

  for (const [examIndex, examDate] of ["2026-06-20", "2026-07-10"].entries()) {
    const cycle = await prisma.examCycle.create({
      data: {
        id: `qa17d-exam-${examIndex + 1}`,
        examCode: `${PREFIX}-EXAM-${examIndex + 1}`,
        academicYear: ACADEMIC_YEAR,
        name: `${PREFIX} Compatible Exam ${examIndex + 1}`,
        examType: "UNIT_TEST",
        startDate: new Date(`${examDate}T00:00:00+05:30`),
        endDate: new Date(`${examDate}T23:59:59+05:30`),
        status: "LOCKED",
        createdByUserId: director.id,
        lockedByUserId: director.id,
        lockedAt: new Date(`${examDate}T16:00:00+05:30`)
      }
    });
    for (const [sectionIndex, section] of ["A", "B"].entries()) {
      const assessment = await prisma.examAssessment.create({
        data: {
          id: `qa17d-assessment-${examIndex + 1}-${section.toLowerCase()}`,
          examCycleId: cycle.id,
          academicYear: ACADEMIC_YEAR,
          className: "QA17D Grade 5",
          section,
          subjectName: subject.name,
          timetableSubjectId: subject.id,
          componentName: "Written",
          assessmentType: "THEORY",
          maxMarks: 100,
          passMarks: 40,
          entryStatus: "LOCKED",
          lockedByUserId: director.id,
          lockedAt: new Date(`${examDate}T16:00:00+05:30`)
        }
      });
      const cohort = students.filter((student) => student.section === section);
      await prisma.studentMark.createMany({
        data: cohort.map((student, studentIndex) => ({
          assessmentId: assessment.id,
          studentId: student.id,
          academicYear: ACADEMIC_YEAR,
          marksObtained: 55 + studentIndex * 5 + examIndex * (sectionIndex === 0 ? 4 : 2),
          entryStatus: "PRESENT",
          enteredByUserId: teacherUsers[sectionIndex].id,
          verifiedByUserId: director.id,
          enteredAt: new Date(`${examDate}T14:00:00+05:30`),
          verifiedAt: new Date(`${examDate}T15:00:00+05:30`)
        }))
      });
    }
  }
  const incompatibleAssessment = await prisma.examAssessment.create({
    data: {
      id: "qa17d-assessment-incompatible-a",
      examCycleId: "qa17d-exam-2",
      academicYear: ACADEMIC_YEAR,
      className: "QA17D Grade 5",
      section: "A",
      subjectName: subject.name,
      timetableSubjectId: subject.id,
      componentName: "Project",
      assessmentType: "PROJECT",
      maxMarks: 50,
      passMarks: 20,
      entryStatus: "LOCKED",
      lockedByUserId: director.id,
      lockedAt: new Date("2026-07-10T16:00:00+05:30")
    }
  });
  await prisma.studentMark.createMany({
    data: students.filter((student) => student.section === "A").map((student, index) => ({
      assessmentId: incompatibleAssessment.id,
      studentId: student.id,
      academicYear: ACADEMIC_YEAR,
      marksObtained: 25 + index * 3,
      entryStatus: "PRESENT",
      enteredByUserId: teacherUsers[0].id,
      verifiedByUserId: director.id
    }))
  });
  const insufficientAssessment = await prisma.examAssessment.create({
    data: {
      id: "qa17d-assessment-insufficient-b",
      examCycleId: "qa17d-exam-2",
      academicYear: ACADEMIC_YEAR,
      className: "QA17D Grade 5",
      section: "B",
      subjectName: subject.name,
      timetableSubjectId: subject.id,
      componentName: "Oral",
      assessmentType: "ORAL",
      maxMarks: 20,
      passMarks: 8,
      entryStatus: "LOCKED",
      lockedByUserId: director.id,
      lockedAt: new Date("2026-07-10T16:00:00+05:30")
    }
  });
  await prisma.studentMark.createMany({
    data: students.filter((student) => student.section === "B").slice(0, 4).map((student, index) => ({
      assessmentId: insufficientAssessment.id,
      studentId: student.id,
      academicYear: ACADEMIC_YEAR,
      marksObtained: 10 + index,
      entryStatus: "PRESENT",
      enteredByUserId: teacherUsers[1].id,
      verifiedByUserId: director.id
    }))
  });
  const markStatusAssessment = await prisma.examAssessment.create({
    data: {
      id: "qa17d-assessment-mark-status-a",
      examCycleId: "qa17d-exam-2",
      academicYear: ACADEMIC_YEAR,
      className: "QA17D Grade 5",
      section: "A",
      subjectName: subject.name,
      timetableSubjectId: subject.id,
      componentName: "Status Context",
      assessmentType: "OTHER",
      maxMarks: 20,
      passMarks: 8,
      entryStatus: "LOCKED",
      lockedByUserId: director.id,
      lockedAt: new Date("2026-07-10T16:30:00+05:30")
    }
  });
  const sectionAStatusStudents = students.filter((student) => student.section === "A");
  await prisma.studentMark.createMany({
    data: [
      { studentId: sectionAStatusStudents[0].id, marksObtained: 0, entryStatus: "PRESENT" },
      { studentId: sectionAStatusStudents[1].id, marksObtained: 15, entryStatus: "PRESENT" },
      { studentId: sectionAStatusStudents[2].id, marksObtained: null, entryStatus: "ABSENT" },
      { studentId: sectionAStatusStudents[3].id, marksObtained: null, entryStatus: "EXEMPT" },
      { studentId: sectionAStatusStudents[4].id, marksObtained: null, entryStatus: "NOT_APPLICABLE" },
      { studentId: sectionAStatusStudents[5].id, marksObtained: 20, entryStatus: "PRESENT" }
    ].map((mark) => ({
      ...mark,
      assessmentId: markStatusAssessment.id,
      academicYear: ACADEMIC_YEAR,
      enteredByUserId: teacherUsers[0].id,
      verifiedByUserId: director.id
    }))
  });
  await prisma.examAssessment.createMany({
    data: [
      { id: "qa17d-assessment-open-a", examCycleId: "qa17d-exam-2", academicYear: ACADEMIC_YEAR, className: "QA17D Grade 5", section: "A", subjectName: subject.name, timetableSubjectId: subject.id, componentName: "Open Sheet", assessmentType: "INTERNAL", maxMarks: 25, entryStatus: "OPEN", createdByUserId: director.id },
      { id: "qa17d-assessment-submitted-a", examCycleId: "qa17d-exam-2", academicYear: ACADEMIC_YEAR, className: "QA17D Grade 5", section: "A", subjectName: subject.name, timetableSubjectId: subject.id, componentName: "Submitted Sheet", assessmentType: "INTERNAL", maxMarks: 25, entryStatus: "SUBMITTED", createdByUserId: director.id, submittedByUserId: teacherUsers[0].id, submittedAt: new Date("2026-07-11T12:00:00+05:30") },
      { id: "qa17d-assessment-approved-a", examCycleId: "qa17d-exam-2", academicYear: ACADEMIC_YEAR, className: "QA17D Grade 5", section: "A", subjectName: subject.name, timetableSubjectId: subject.id, componentName: "Approved Sheet", assessmentType: "INTERNAL", maxMarks: 25, entryStatus: "APPROVED", createdByUserId: director.id, submittedByUserId: teacherUsers[0].id, submittedAt: new Date("2026-07-11T12:00:00+05:30"), approvedByUserId: director.id, approvedAt: new Date("2026-07-11T13:00:00+05:30") }
    ]
  });
  await prisma.studentMarkEvent.create({
    data: {
      id: "qa17d-mark-correction-event",
      assessmentId: "qa17d-assessment-2-a",
      eventType: "CORRECTION_APPLIED",
      previousMarks: 58,
      newMarks: 59,
      previousEntryStatus: "PRESENT",
      newEntryStatus: "PRESENT",
      reason: "QA authorised arithmetic correction",
      actorLabel: "QA17D leadership",
      eventDate: new Date("2026-07-11T14:00:00+05:30")
    }
  });

  const markTemplate = await prisma.reportCardTemplate.create({
    data: { id: "qa17d-mark-template", templateCode: `${PREFIX}-MARK-TEMPLATE`, name: `${PREFIX} Mark Template`, reportType: "MARK_BASED", academicYear: ACADEMIC_YEAR, className: "QA17D Grade 5", status: "ACTIVE", templateDefinitionJson: JSON.stringify(DEFAULT_MARK_TEMPLATE), activatedByUserId: director.id }
  });
  const kgTemplate = await prisma.reportCardTemplate.create({
    data: { id: "qa17d-kg-template", templateCode: `${PREFIX}-KG-TEMPLATE`, name: `${PREFIX} KG Template`, reportType: "KG_RUBRIC", academicYear: ACADEMIC_YEAR, className: "QA17D Grade 5", status: "ACTIVE", templateDefinitionJson: JSON.stringify(DEFAULT_KG_TEMPLATE), activatedByUserId: director.id }
  });
  const snapshotGradeBands = [{ gradeCode: "A", label: "Context complete", minimumPercentage: "0", maximumPercentage: "100", displayOrder: 1, remarks: null }];
  const markTemplateSnapshot = JSON.stringify({
    templateCode: markTemplate.templateCode, name: markTemplate.name, reportType: markTemplate.reportType, versionNumber: markTemplate.versionNumber,
    definition: DEFAULT_MARK_TEMPLATE, printSettings: null, gradingScheme: { schemeCode: `${PREFIX}-MARK-SNAPSHOT`, name: `${PREFIX} Mark Snapshot`, bands: snapshotGradeBands }
  });
  const kgTemplateSnapshot = JSON.stringify({
    templateCode: kgTemplate.templateCode, name: kgTemplate.name, reportType: kgTemplate.reportType, versionNumber: kgTemplate.versionNumber,
    definition: DEFAULT_KG_TEMPLATE, printSettings: null, gradingScheme: { schemeCode: `${PREFIX}-KG-SNAPSHOT`, name: `${PREFIX} KG Snapshot`, bands: snapshotGradeBands }
  });
  const markBatch = await prisma.reportCardBatch.create({
    data: { id: "qa17d-mark-batch", batchNumber: `${PREFIX}-MARK-BATCH`, academicYear: ACADEMIC_YEAR, reportType: "MARK_BASED", templateId: markTemplate.id, className: "QA17D Grade 5", section: "A", title: `${PREFIX} Mark Cards`, status: "ISSUED", templateSnapshotJson: markTemplateSnapshot, createdByUserId: director.id, issuedByUserId: director.id, issuedAt: new Date("2026-07-12T12:00:00+05:30") }
  });
  const kgBatch = await prisma.reportCardBatch.create({
    data: { id: "qa17d-kg-batch", batchNumber: `${PREFIX}-KG-BATCH`, academicYear: ACADEMIC_YEAR, reportType: "KG_RUBRIC", templateId: kgTemplate.id, className: "QA17D Grade 5", section: "B", title: `${PREFIX} KG Cards`, status: "OPEN_FOR_ENTRY", templateSnapshotJson: kgTemplateSnapshot, createdByUserId: director.id, openedByUserId: director.id, openedAt: new Date("2026-07-12T09:00:00+05:30") }
  });
  await prisma.reportCardBatchExamSource.create({
    data: { id: "qa17d-mark-batch-source", batchId: markBatch.id, examCycleId: "qa17d-exam-2", displayOrder: 1 }
  });
  const sectionAStudents = students.filter((student) => student.section === "A");
  await prisma.studentReportCard.createMany({
    data: sectionAStudents.map((student, index) => ({
      id: `qa17d-mark-card-${index + 1}`,
      reportCardNumber: `${PREFIX}-MARK-${index + 1}`,
      batchId: markBatch.id,
      studentId: student.id,
      academicYear: ACADEMIC_YEAR,
      className: "QA17D Grade 5",
      section: "A",
      reportType: "MARK_BASED",
      status: index < 2 ? "ISSUED" : index < 4 ? "APPROVED" : "DRAFT",
      currentVersionNumber: index < 2 ? 1 : 0,
      draftDataJson: JSON.stringify({ kind: "MARK_BASED", calculation: { rows: [], blockingGaps: [] } }),
      teacherOverallComment: index < 4 ? "QA contextual Teacher comment." : null,
      createdByUserId: teacherUsers[0].id,
      approvedByUserId: index < 4 ? director.id : null,
      issuedByUserId: index < 2 ? director.id : null,
      approvedAt: index < 4 ? new Date("2026-07-12T11:00:00+05:30") : null,
      issuedAt: index < 2 ? new Date("2026-07-12T12:00:00+05:30") : null
    }))
  });
  await prisma.studentReportCardVersion.createMany({
    data: sectionAStudents.slice(0, 2).map((_, index) => ({
      id: `qa17d-mark-card-version-${index + 1}`,
      reportCardId: `qa17d-mark-card-${index + 1}`,
      versionNumber: 1,
      versionType: "ORIGINAL",
      snapshotJson: JSON.stringify({
        status: "ISSUED",
        versionNumber: 1,
        reportType: "MARK_BASED",
        reportCardNumber: `${PREFIX}-MARK-${index + 1}`
      }),
      issuedAt: new Date("2026-07-12T12:00:00+05:30"),
      issuedByUserId: director.id
    }))
  });
  const kgDraft = createEmptyKgDraft();
  const responseSets = KG_RESPONSE_SETS as Record<string, readonly string[]>;
  for (const evaluation of KG_EVALUATIONS) {
    for (const [key, , , set] of KG_CRITERIA) kgDraft.rubrics[evaluation][key] = responseSets[set][0];
    for (const key of KG_SUMMARY_AREAS) kgDraft.summaryGrades[evaluation][key] = "A";
    for (const key of KG_PERSONALITY_TRAITS) kgDraft.personality[evaluation][key] = "G";
    kgDraft.evaluationComments[evaluation].comment = `QA Evaluation ${evaluation} complete.`;
  }
  kgDraft.attendance = KG_ATTENDANCE_MONTHS.map((month) => ({ month, workingDays: 20, daysPresent: 18 }));
  kgDraft.attendanceSource = { status: "CALCULATED_FROM_ATTENDANCE", overrideReason: null };
  for (const evaluation of KG_GROWTH_PERIODS) kgDraft.growth[evaluation] = { heightCm: 110, weightKg: 20, observationDate: "2026-07-12" };
  kgDraft.final = { grade: "A", comment: "QA contextual completion.", nextClass: "QA17D Grade 6", nextSessionStartDate: "2027-04-01" };
  const sectionBStudents = students.filter((student) => student.section === "B");
  await prisma.studentReportCard.createMany({
    data: sectionBStudents.map((student, index) => ({
      id: `qa17d-kg-card-${index + 1}`,
      reportCardNumber: `${PREFIX}-KG-${index + 1}`,
      batchId: kgBatch.id,
      studentId: student.id,
      academicYear: ACADEMIC_YEAR,
      className: "QA17D Grade 5",
      section: "B",
      reportType: "KG_RUBRIC",
      status: index < 3 ? "READY_FOR_REVIEW" : "DRAFT",
      draftDataJson: JSON.stringify(kgDraft),
      teacherOverallComment: "QA KG contextual comment.",
      createdByUserId: teacherUsers[1].id,
      submittedByUserId: index < 3 ? teacherUsers[1].id : null,
      submittedAt: index < 3 ? new Date("2026-07-12T10:00:00+05:30") : null
    }))
  });
  console.log(JSON.stringify({
    status: "QA17D fixtures created",
    teacherUsernames: teacherUsers.map((user) => user.username),
    teacherPassword: PASSWORD,
    eligibleTeachers: staff.length,
    students: students.length,
    timetableAssignments: assignments.length,
    incompatibleAssessments: 1,
    insufficientCohortAssessments: 1,
    markStatusAssessments: 1,
    markReportCards: sectionAStudents.length,
    kgReportCards: sectionBStudents.length
  }, null, 2));
}

async function inspect() {
  const counts = {
    cycles: await prisma.teacherAnalyticsReviewCycle.count({ where: { cycleCode: { startsWith: PREFIX } } }),
    snapshots: await prisma.teacherAnalyticsSnapshot.count({ where: { reviewCycle: { cycleCode: { startsWith: PREFIX } } } }),
    staff: await prisma.staffMember.count({ where: { staffCode: { startsWith: PREFIX } } }),
    users: await prisma.user.count({ where: { username: { startsWith: "qa17d-" } } }),
    students: await prisma.student.count({ where: { admissionNo: { startsWith: PREFIX } } }),
    homework: await prisma.homeworkAssignment.count({ where: { assignmentNumber: { startsWith: PREFIX } } }),
    exams: await prisma.examCycle.count({ where: { examCode: { startsWith: PREFIX } } }),
    assessments: await prisma.examAssessment.count({ where: { examCycle: { examCode: { startsWith: PREFIX } } } }),
    marks: await prisma.studentMark.count({ where: { assessment: { examCycle: { examCode: { startsWith: PREFIX } } } } }),
    reportCards: await prisma.studentReportCard.count({ where: { reportCardNumber: { startsWith: PREFIX } } }),
    reportCardBatches: await prisma.reportCardBatch.count({ where: { batchNumber: { startsWith: PREFIX } } }),
    attendanceSessions: await prisma.staffAttendanceSession.count({ where: { notes: { startsWith: PREFIX } } }),
    leaveRequests: await prisma.staffLeaveRequest.count({ where: { notes: { startsWith: PREFIX } } }),
    substitutes: await prisma.substituteAssignment.count({ where: { notes: { startsWith: PREFIX } } }),
    timetableTeachers: await prisma.timetableTeacher.count({ where: { shortName: { startsWith: PREFIX } } }),
    timetableAssignments: await prisma.timetableAssignment.count({ where: { notes: { startsWith: PREFIX } } }),
    classSections: await prisma.timetableClassSection.count({ where: { displayName: { startsWith: PREFIX } } }),
    subjects: await prisma.timetableSubject.count({ where: { shortName: { startsWith: PREFIX } } })
  };
  console.log(JSON.stringify(counts, null, 2));
}

async function main() {
  const action = process.argv[2];
  if (action === "setup") await setup();
  else if (action === "cleanup") { await cleanup(); await inspect(); }
  else if (action === "inspect") await inspect();
  else throw new Error("Use: pnpm exec tsx scripts/qa17d-fixtures.ts setup|cleanup|inspect");
}

main().finally(() => prisma.$disconnect());
