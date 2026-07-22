import { csvCell } from "@/lib/expenses";
import { schoolDateKey } from "@/lib/format";

export function homeworkDueGroup(row: { dueDate: Date | null; status: string }, now = new Date()) {
  if (!row.dueDate || !["DRAFT", "PUBLISHED"].includes(row.status)) return row.dueDate ? "NONE" : "NO_DUE_DATE";
  const due = row.dueDate.toISOString().slice(0, 10), today = schoolDateKey(now);
  return due === today ? "DUE_TODAY" : due < today ? "OVERDUE" : "UPCOMING";
}

export function buildHomeworkReports(rows: any[], now = new Date(), masked = false) {
  const countBy = (key: (row: any) => string) => [...rows.reduce((map, row) => { const value = key(row); map.set(value, (map.get(value) ?? 0) + 1); return map; }, new Map<string, number>())].map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label));
  const dueGroups = countBy((row) => homeworkDueGroup(row, now));
  return {
    total: rows.length,
    status: countBy((row) => row.status),
    class: countBy((row) => row.className),
    section: countBy((row) => `${row.className}-${row.section ?? "All sections"}`),
    subject: countBy((row) => row.subjectName),
    creator: masked ? [] : countBy((row) => row.createdBy?.name ?? "Staff"),
    due: dueGroups,
    recentCorrections: rows.filter((row) => row.events?.some((event: any) => event.eventType === "CORRECTED")).slice(0, 20).map((row) => ({ assignmentNumber: masked ? "Masked" : row.assignmentNumber, title: row.title, className: row.className, section: row.section, subjectName: row.subjectName })),
    cancelled: rows.filter((row) => row.status === "CANCELLED").map((row) => ({ assignmentNumber: masked ? "Masked" : row.assignmentNumber, title: row.title, className: row.className, section: row.section, subjectName: row.subjectName }))
  };
}

export function homeworkReportCsv(rows: any[], now = new Date()) {
  const headers = ["Assignment Number", "Academic Year", "Class", "Section", "Subject", "Title", "Assigned Date", "Due Date", "Due Group", "Priority", "Status", "Creator"];
  const body = rows.map((row) => [row.assignmentNumber, row.academicYear, row.className, row.section ?? "All sections", row.subjectName, row.title, row.assignedDate.toISOString().slice(0, 10), row.dueDate?.toISOString().slice(0, 10) ?? "", homeworkDueGroup(row, now), row.priority, row.status, row.createdBy?.name ?? "Staff"].map(csvCell).join(","));
  return [headers.map(csvCell).join(","), ...body].join("\r\n") + "\r\n";
}

export function homeworkReportFilename(now = new Date()) { return `homework-report-${schoolDateKey(now)}.csv`; }
