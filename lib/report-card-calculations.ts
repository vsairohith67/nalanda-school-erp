import { Prisma } from "@prisma/client";

export type ReportMarkRow = { subjectName: string; componentName?: string | null; maxMarks: Prisma.Decimal | number | string; passMarks?: Prisma.Decimal | number | string | null; weightagePercent?: Prisma.Decimal | number | string | null; entryStatus?: string | null; marksObtained?: Prisma.Decimal | number | string | null };
export type ReportGradeBand = { gradeCode: string; label: string; minimumPercentage: Prisma.Decimal | number | string; maximumPercentage?: Prisma.Decimal | number | string | null };

export function calculateMarkReport(rows: ReportMarkRow[], bands: ReportGradeBand[]) {
  if (!rows.length) return { rows: [], totalObtained: 0, totalMaximum: 0, percentage: null, grade: null, result: "INCOMPLETE", blockingGaps: ["No locked assessment rows were found."] };
  const blockingGaps: string[] = [];
  let totalObtained = new Prisma.Decimal(0); let totalMaximum = new Prisma.Decimal(0); let failed = false;
  const calculatedRows = rows.map((row) => {
    const status = String(row.entryStatus ?? "MISSING").toUpperCase(); const maximum = decimal(row.maxMarks); const pass = row.passMarks === null || row.passMarks === undefined ? null : decimal(row.passMarks); const weightage = row.weightagePercent === null || row.weightagePercent === undefined ? null : decimal(row.weightagePercent);
    if (!["PRESENT", "ABSENT", "EXEMPT", "NOT_APPLICABLE"].includes(status)) blockingGaps.push(`${row.subjectName}${row.componentName ? ` / ${row.componentName}` : ""}: missing mark or valid status`);
    let obtained: Prisma.Decimal | null = null; let weightedObtained: Prisma.Decimal | null = null; let weightedMaximum: Prisma.Decimal | null = null;
    if (status === "PRESENT") {
      if (row.marksObtained === null || row.marksObtained === undefined || row.marksObtained === "") blockingGaps.push(`${row.subjectName}: Present requires marks`);
      else { obtained = decimal(row.marksObtained); if (obtained.lt(0) || obtained.gt(maximum)) blockingGaps.push(`${row.subjectName}: marks are outside the valid range`); }
    }
    if (status === "PRESENT" || status === "ABSENT") {
      weightedMaximum = weightage ?? maximum;
      weightedObtained = status === "PRESENT" && obtained ? (weightage ? obtained.div(maximum).mul(weightage) : obtained) : new Prisma.Decimal(0);
      totalMaximum = totalMaximum.add(weightedMaximum); totalObtained = totalObtained.add(weightedObtained);
      if (status === "ABSENT" || (pass && obtained && obtained.lt(pass))) failed = true;
    }
    return { subjectName: row.subjectName, componentName: row.componentName ?? null, status, marksObtained: obtained?.toNumber() ?? null, maxMarks: maximum.toNumber(), passMarks: pass?.toNumber() ?? null, weightagePercent: weightage?.toNumber() ?? null, countedInDenominator: status === "PRESENT" || status === "ABSENT", weightedObtained: weightedObtained?.toNumber() ?? null, weightedMaximum: weightedMaximum?.toNumber() ?? null };
  });
  const percentage = blockingGaps.length || totalMaximum.eq(0) ? null : round(totalObtained.div(totalMaximum).mul(100).toNumber());
  const gradeBand = percentage === null ? null : findGradeBand(percentage, bands);
  if (percentage !== null && !gradeBand) blockingGaps.push("No grading band covers the calculated percentage.");
  return { rows: calculatedRows, totalObtained: round(totalObtained.toNumber()), totalMaximum: round(totalMaximum.toNumber()), percentage, grade: gradeBand ? { code: gradeBand.gradeCode, label: gradeBand.label } : null, result: blockingGaps.length ? "INCOMPLETE" : failed ? "FAIL" : "PASS", blockingGaps, denominatorPolicy: "PRESENT_AND_ABSENT; EXEMPT_AND_NOT_APPLICABLE_EXCLUDED" };
}

export function findGradeBand(percentage: number, bands: ReportGradeBand[]) { return [...bands].sort((a, b) => decimal(b.minimumPercentage).cmp(decimal(a.minimumPercentage))).find((band) => { const min = decimal(band.minimumPercentage); const max = band.maximumPercentage === null || band.maximumPercentage === undefined ? new Prisma.Decimal(100) : decimal(band.maximumPercentage); return new Prisma.Decimal(percentage).gte(min) && new Prisma.Decimal(percentage).lte(max); }) ?? null; }
function decimal(value: Prisma.Decimal | number | string) { return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value); }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
