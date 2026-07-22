import { csvEscape } from "@/lib/format";

function grouped(rows: any[], field: string) {
  return rows.reduce((out: Record<string, number>, row) => {
    const key = String(row[field] ?? "UNKNOWN");
    out[key] = (out[key] ?? 0) + 1;
    return out;
  }, {});
}

export function certificateReportSummary(requests: any[], certificates: any[], series: any[], events: any[] = []) {
  const count = (rows: any[], predicate: (row: any) => boolean) => rows.filter(predicate).length;
  const turnaroundHours = requests
    .filter(row => row.submittedAt && row.completedAt)
    .map(row => Math.max(0, (new Date(row.completedAt).getTime() - new Date(row.submittedAt).getTime()) / 3_600_000));
  return {
    requests: requests.length, submitted: count(requests, r => r.status === "SUBMITTED"), underReview: count(requests, r => r.status === "UNDER_REVIEW"),
    approvedAwaitingIssue: count(requests, r => r.status === "APPROVED"), rejectedOrCancelled: count(requests, r => ["REJECTED", "CANCELLED"].includes(r.status)),
    parentRequests: count(requests, r => r.requestSource === "PARENT_PORTAL"), internalRequests: count(requests, r => r.requestSource === "INTERNAL"),
    issued: count(certificates, r => r.status === "ISSUED"), cancelled: count(certificates, r => r.status === "CANCELLED"),
    corrected: count(events, row => row.eventType === "CERTIFICATE_CORRECTED"), reissued: count(events, row => row.eventType === "CERTIFICATE_REISSUED"),
    averageTurnaroundHours: turnaroundHours.length ? Number((turnaroundHours.reduce((sum, value) => sum + value, 0) / turnaroundHours.length).toFixed(2)) : 0,
    transferActiveWarnings: count(certificates, r => r.certificateType === "TRANSFER" && String(r.draftDataJson).includes('"status":"ACTIVE"')),
    missingAttendance: count(certificates, r => String(r.draftDataJson).includes('"attendance":null')),
    missingSourceData: count(certificates, r => /history is missing|history may be incomplete|snapshot is unavailable/i.test(String(r.draftDataJson))),
    requestsByType: grouped(requests, "certificateType"), requestsByStatus: grouped(requests, "status"), requestsBySource: grouped(requests, "requestSource"),
    seriesUsage: series.map(s => ({ seriesCode: s.seriesCode, certificateType: s.certificateType, lastAllocated: Math.max(0, s.nextNumber - 1), nextNumber: s.nextNumber }))
  };
}

function safe(value: unknown) { const text = String(value ?? ""); return /^[=+\-@]/.test(text) ? `'${text}` : text; }
export function certificateReportsCsv(rows: any[]) {
  const headers = ["Request Number", "Academic Year", "Certificate Type", "Source", "Urgency", "Request Status", "Certificate Number", "Certificate Status", "Issue Date"];
  return [headers, ...rows.map(row => [row.requestNumber, row.academicYear, row.certificateType, row.requestSource, row.urgency, row.requestStatus, row.certificateNumber, row.certificateStatus, row.issueDate])].map(row => row.map(value => csvEscape(safe(value))).join(",")).join("\n");
}
