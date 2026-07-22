import { Prisma, type PrismaClient } from "@prisma/client";
import { csvCell } from "@/lib/expenses";
import { schoolDateKey } from "@/lib/format";
import { marksScopeWhere, type MarksScope } from "@/lib/marks-scope";

export async function buildExamReports(
  prisma: PrismaClient,
  scope: MarksScope,
  filters: { academicYear?: string; examCode?: string } = {},
  masked = false
) {
  const assessmentWhere = {
    ...marksScopeWhere(scope),
    ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
    ...(filters.examCode ? { examCycle: { examCode: filters.examCode } } : {})
  };
  const examWhere = {
    ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
    ...(filters.examCode ? { examCode: filters.examCode } : {})
  };
  const [assessments, broadExamConfiguration] = await Promise.all([
    prisma.examAssessment.findMany({
      where: assessmentWhere,
      include: {
        examCycle: { select: { examCode: true, name: true, status: true } },
        marks: true,
        events: {
          where: { eventType: { in: ["CORRECTION_REQUESTED", "CORRECTION_APPLIED"] } },
          orderBy: { eventDate: "desc" }
        }
      },
      orderBy: [{ examCycle: { startDate: "desc" } }, { className: "asc" }, { section: "asc" }, { subjectName: "asc" }]
    }),
    scope.broad
      ? prisma.examCycle.findMany({
          where: examWhere,
          select: { examCode: true, name: true, status: true, _count: { select: { assessments: true } } },
          orderBy: { startDate: "desc" }
        })
      : Promise.resolve([])
  ]);

  const keys = [...new Map(assessments.map((row) => [
    `${row.academicYear}|${row.className}|${row.section}`,
    { academicYear: row.academicYear, className: row.className, section: row.section }
  ])).values()];
  const enrollmentCounts = new Map<string, number>();
  for (const key of keys) {
    enrollmentCounts.set(
      `${key.academicYear}|${key.className}|${key.section}`,
      await prisma.academicYearEnrollment.count({
        where: {
          academicYear: key.academicYear,
          className: key.className,
          ...(key.section ? { section: key.section } : {}),
          status: "ACTIVE",
          student: { deletedAt: null, status: "Active" }
        }
      })
    );
  }

  const rows = assessments.map((assessment) => {
    const eligible = enrollmentCounts.get(`${assessment.academicYear}|${assessment.className}|${assessment.section}`) ?? 0;
    const present = assessment.marks.filter((mark) => mark.entryStatus === "PRESENT" && mark.marksObtained !== null);
    const total = present.reduce((sum, mark) => sum.add(mark.marksObtained!), new Prisma.Decimal(0));
    const average = present.length ? total.div(present.length) : null;
    const values = present.map((mark) => mark.marksObtained!);
    const highest = values.reduce<Prisma.Decimal | null>((best, value) => best === null || value.gt(best) ? value : best, null);
    const lowest = values.reduce<Prisma.Decimal | null>((best, value) => best === null || value.lt(best) ? value : best, null);
    const passed = assessment.passMarks === null ? null : present.filter((mark) => mark.marksObtained!.gte(assessment.passMarks!)).length;
    const failed = passed === null ? null : present.length - passed;
    return {
      examCode: assessment.examCycle.examCode,
      examName: assessment.examCycle.name,
      examStatus: assessment.examCycle.status,
      academicYear: assessment.academicYear,
      className: assessment.className,
      section: assessment.section || "Class-wide",
      subjectName: assessment.subjectName,
      componentName: assessment.componentName || "Main",
      assessmentType: assessment.assessmentType,
      assessmentStatus: assessment.entryStatus,
      maxMarks: assessment.maxMarks.toString(),
      passMarks: assessment.passMarks?.toString() ?? null,
      eligible,
      entered: assessment.marks.length,
      missing: Math.max(0, eligible - assessment.marks.length),
      present: present.length,
      absent: assessment.marks.filter((mark) => mark.entryStatus === "ABSENT").length,
      exempt: assessment.marks.filter((mark) => mark.entryStatus === "EXEMPT").length,
      notApplicable: assessment.marks.filter((mark) => mark.entryStatus === "NOT_APPLICABLE").length,
      average: average?.toDecimalPlaces(4).toString() ?? null,
      highest: highest?.toString() ?? null,
      lowest: lowest?.toString() ?? null,
      passed,
      failed,
      correctionCount: assessment.events.filter((event) => event.eventType === "CORRECTION_APPLIED").length
    };
  });

  const scopedConfiguration = [...rows.reduce((map, row) => {
    const existing = map.get(row.examCode);
    map.set(row.examCode, {
      examCode: masked ? "Masked" : row.examCode,
      examName: row.examName,
      status: row.examStatus,
      assessmentCount: (existing?.assessmentCount ?? 0) + 1
    });
    return map;
  }, new Map<string, { examCode: string; examName: string; status: string; assessmentCount: number }>()).values()];
  const configuration = scope.broad
    ? broadExamConfiguration.map((exam) => ({
        examCode: masked ? "Masked" : exam.examCode,
        examName: exam.name,
        status: exam.status,
        assessmentCount: exam._count.assessments
      }))
    : scopedConfiguration;
  const countBy = (key: (row: typeof rows[number]) => string) => [...rows.reduce((map, row) => {
    const label = key(row);
    map.set(label, (map.get(label) ?? 0) + 1);
    return map;
  }, new Map<string, number>())].map(([label, count]) => ({ label, count }));
  const resultDistribution = {
    passed: rows.reduce((sum, row) => sum + (row.passed ?? 0), 0),
    failed: rows.reduce((sum, row) => sum + (row.failed ?? 0), 0),
    presentWithoutPassMarks: rows.reduce((sum, row) => sum + (row.passed === null ? row.present : 0), 0),
    absent: rows.reduce((sum, row) => sum + row.absent, 0),
    exempt: rows.reduce((sum, row) => sum + row.exempt, 0),
    notApplicable: rows.reduce((sum, row) => sum + row.notApplicable, 0)
  };
  const publicRows = masked ? rows.map((row) => ({ ...row, examCode: "Masked" })) : rows;
  const cancelled = [
    ...rows.filter((row) => row.examStatus === "CANCELLED" || row.assessmentStatus === "CANCELLED"),
    ...(scope.broad ? broadExamConfiguration
      .filter((exam) => exam.status === "CANCELLED" && exam._count.assessments === 0)
      .map((exam) => ({
        examCode: exam.examCode,
        className: "No assessments",
        section: "—",
        subjectName: "Configuration only",
        examStatus: exam.status,
        assessmentStatus: "—"
      })) : [])
  ].map((row) => masked ? { ...row, examCode: "Masked" } : row);

  return {
    rows: publicRows,
    configuration: {
      rows: configuration,
      complete: configuration.filter((row) => row.assessmentCount > 0).length,
      incomplete: configuration.filter((row) => row.assessmentCount === 0).length
    },
    resultDistribution,
    totals: {
      exams: configuration.length,
      assessments: rows.length,
      eligibleEntries: rows.reduce((sum, row) => sum + row.eligible, 0),
      entered: rows.reduce((sum, row) => sum + row.entered, 0),
      missing: rows.reduce((sum, row) => sum + row.missing, 0),
      absent: resultDistribution.absent,
      exempt: resultDistribution.exempt,
      corrections: rows.reduce((sum, row) => sum + row.correctionCount, 0)
    },
    byAssessmentStatus: countBy((row) => row.assessmentStatus),
    byExamStatus: countBy((row) => row.examStatus),
    teacherSubmissionStatus: rows.map((row) => ({
      examCode: masked ? "Masked" : row.examCode,
      target: `${row.className}-${row.section} ${row.subjectName} ${row.componentName}`,
      status: row.assessmentStatus,
      missing: row.missing
    })),
    cancelled
  };
}

export function examReportsCsv(rows: Array<Record<string, any>>) {
  const headers = ["Exam Code", "Exam Name", "Academic Year", "Class", "Section", "Subject", "Component", "Assessment Type", "Exam Status", "Sheet Status", "Maximum Marks", "Pass Marks", "Eligible", "Entered", "Missing", "Present", "Absent", "Exempt", "Not Applicable", "Average", "Highest", "Lowest", "Derived Pass", "Derived Fail", "Corrections"];
  const body = rows.map((row) => [row.examCode, row.examName, row.academicYear, row.className, row.section, row.subjectName, row.componentName, row.assessmentType, row.examStatus, row.assessmentStatus, row.maxMarks, row.passMarks, row.eligible, row.entered, row.missing, row.present, row.absent, row.exempt, row.notApplicable, row.average, row.highest, row.lowest, row.passed, row.failed, row.correctionCount].map(csvCell).join(","));
  return [headers.map(csvCell).join(","), ...body].join("\r\n") + "\r\n";
}

export function examReportsFilename(now = new Date()) {
  return `exam-marks-report-${schoolDateKey(now)}.csv`;
}
