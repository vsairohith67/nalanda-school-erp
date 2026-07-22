import type { PrismaClient } from "@prisma/client";
import { csvCell } from "@/lib/expenses";

function group(rows: any[], key: (row: any) => string) {
  const grouped = rows.reduce<Map<string, number>>((map, row) => { const label = key(row) || "Not recorded"; map.set(label, (map.get(label) ?? 0) + 1); return map; }, new Map<string, number>());
  return Array.from(grouped.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => a.label.localeCompare(b.label));
}

export async function loadLibraryReports(client: Pick<PrismaClient, "libraryTitle" | "libraryCopy" | "libraryCopyEvent">) {
  const [titles, copies, events] = await Promise.all([
    client.libraryTitle.findMany({ include: { publisherVendor: { select: { vendorCode: true, name: true } }, copies: { select: { id: true, status: true } } }, orderBy: { titleCode: "asc" } }),
    client.libraryCopy.findMany({ include: { title: { select: { titleCode: true, title: true, language: true, subject: true, category: true, publisherName: true } }, vendor: { select: { vendorCode: true, name: true } }, expenseRecord: { select: { expenseNumber: true } } }, orderBy: { accessionNumber: "asc" } }),
    client.libraryCopyEvent.findMany({ include: { copy: { select: { accessionNumber: true, title: { select: { titleCode: true, title: true } } } }, recordedBy: { select: { name: true } } }, orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }], take: 100 })
  ]);
  const countStatus = (status: string) => copies.filter((copy) => copy.status === status).length;
  return {
    summary: { titles: titles.length, copies: copies.length, available: countStatus("AVAILABLE"), underRepair: countStatus("UNDER_REPAIR"), missing: countStatus("MISSING"), withdrawn: countStatus("WITHDRAWN"), titleMetadataGaps: titles.filter((t) => !t.isbn || !t.authors || !t.category).length, copyMetadataGaps: copies.filter((c) => !c.shelfCode || !c.acquisitionDate || !c.acquisitionType).length },
    titleWise: titles.map((t) => ({ titleCode: t.titleCode, title: t.title, authors: t.authors, isbn: t.isbn, status: t.status, copies: t.copies.length, available: t.copies.filter((c) => c.status === "AVAILABLE").length })),
    status: group(copies, (c) => c.status),
    condition: group(copies, (c) => c.condition),
    shelf: group(copies, (c) => c.shelfCode ?? "Shelf missing"),
    language: group(titles, (t) => t.language ?? "Language missing"),
    subject: group(titles, (t) => t.subject ?? "Subject missing"),
    category: group(titles, (t) => t.category ?? "Category missing"),
    publisher: group(titles, (t) => t.publisherName ?? t.publisherVendor?.name ?? "Publisher missing"),
    acquisition: group(copies, (c) => c.acquisitionType),
    linkage: { vendorLinked: copies.filter((c) => c.vendorId).length, vendorMissing: copies.filter((c) => !c.vendorId).length, expenseLinked: copies.filter((c) => c.expenseRecordId).length, expenseMissing: copies.filter((c) => !c.expenseRecordId).length },
    titleGaps: titles.filter((t) => !t.isbn || !t.authors || !t.category).map((t) => ({ titleCode: t.titleCode, title: t.title, missing: [!t.isbn && "ISBN", !t.authors && "author", !t.category && "category"].filter(Boolean).join(", ") })),
    copyGaps: copies.filter((c) => !c.shelfCode || !c.acquisitionDate || !c.acquisitionType).map((c) => ({ accessionNumber: c.accessionNumber, titleCode: c.title.titleCode, title: c.title.title, missing: [!c.shelfCode && "shelf", !c.acquisitionDate && "acquisition date", !c.acquisitionType && "acquisition type"].filter(Boolean).join(", ") })),
    withdrawn: copies.filter((c) => c.status === "WITHDRAWN").map((c) => ({ accessionNumber: c.accessionNumber, titleCode: c.title.titleCode, title: c.title.title, withdrawnDate: c.withdrawnDate?.toISOString().slice(0, 10) ?? "", reason: c.withdrawalReason ?? "" })),
    accessionRegister: copies.map((c) => ({ accessionNumber: c.accessionNumber, titleCode: c.title.titleCode, title: c.title.title, condition: c.condition, status: c.status, shelfCode: c.shelfCode ?? "", acquisitionDate: c.acquisitionDate?.toISOString().slice(0, 10) ?? "", acquisitionType: c.acquisitionType, acquisitionCost: c.acquisitionCost?.toFixed(2) ?? "", vendor: c.vendor?.name ?? "", vendorCode: c.vendor?.vendorCode ?? "", expenseNumber: c.expenseRecord?.expenseNumber ?? "", donorName: c.donorName ?? "", invoiceNumber: c.invoiceNumberSnapshot ?? "" })),
    recentEvents: events.map((event) => ({ eventDate: event.eventDate.toISOString(), accessionNumber: event.copy.accessionNumber, titleCode: event.copy.title.titleCode, title: event.copy.title.title, eventType: event.eventType, previousStatus: event.previousStatus ?? "", newStatus: event.newStatus ?? "", previousCondition: event.previousCondition ?? "", newCondition: event.newCondition ?? "", previousShelfCode: event.previousShelfCode ?? "", newShelfCode: event.newShelfCode ?? "", reason: event.reason ?? "", actorLabel: event.recordedBy?.name ?? "System / restored record" }))
  };
}

export type LibraryReportType = "accession-register" | "title-summary" | "status-summary" | "condition-summary" | "shelf-summary" | "language-summary" | "subject-summary" | "category-summary" | "publisher-summary" | "acquisition-summary" | "linkage-completeness" | "title-gaps" | "copy-gaps" | "withdrawn-register" | "recent-events";
export const LIBRARY_REPORT_TYPES: LibraryReportType[] = ["accession-register", "title-summary", "status-summary", "condition-summary", "shelf-summary", "language-summary", "subject-summary", "category-summary", "publisher-summary", "acquisition-summary", "linkage-completeness", "title-gaps", "copy-gaps", "withdrawn-register", "recent-events"];

function csv(headers: string[], rows: Array<Array<unknown>>) { return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n"; }
export function libraryReportCsv(report: Awaited<ReturnType<typeof loadLibraryReports>>, type: LibraryReportType) {
  if (type === "accession-register") return csv(["Accession Number", "Title Code", "Title", "Condition", "Status", "Shelf", "Acquisition Date", "Acquisition Type", "Acquisition Cost", "Vendor", "Vendor Code", "Expense Number", "Donor", "Invoice Number"], report.accessionRegister.map((r) => Object.values(r)));
  if (type === "title-summary") return csv(["Title Code", "Title", "Authors", "ISBN", "Status", "Copies", "Available"], report.titleWise.map((r) => Object.values(r)));
  if (["status-summary", "condition-summary", "shelf-summary", "language-summary", "subject-summary", "category-summary", "publisher-summary", "acquisition-summary"].includes(type)) {
    const key = type.replace("-summary", "") as "status" | "condition" | "shelf" | "language" | "subject" | "category" | "publisher" | "acquisition";
    return csv([key[0].toUpperCase() + key.slice(1), "Count"], report[key].map((r) => [r.label, r.count]));
  }
  if (type === "linkage-completeness") return csv(["Linkage", "Count"], Object.entries(report.linkage).map(([label, count]) => [label, count]));
  if (type === "title-gaps") return csv(["Title Code", "Title", "Missing Metadata"], report.titleGaps.map((r) => Object.values(r)));
  if (type === "copy-gaps") return csv(["Accession Number", "Title Code", "Title", "Missing Metadata"], report.copyGaps.map((r) => Object.values(r)));
  if (type === "withdrawn-register") return csv(["Accession Number", "Title Code", "Title", "Withdrawn Date", "Reason"], report.withdrawn.map((r) => Object.values(r)));
  return csv(["Event Date", "Accession Number", "Title Code", "Title", "Event", "Previous Status", "New Status", "Previous Condition", "New Condition", "Previous Shelf", "New Shelf", "Reason", "Recorded By"], report.recentEvents.map((r) => Object.values(r)));
}

export function serializeLibraryReportPayload(report: Awaited<ReturnType<typeof loadLibraryReports>>, restricted = false) {
  if (!restricted) return report;
  return {
    ...report,
    accessionRegister: report.accessionRegister.map(({ vendor, vendorCode, expenseNumber, donorName: _donorName, invoiceNumber: _invoiceNumber, ...row }) => ({
      ...row,
      vendorLink: vendor || vendorCode ? "Linked" : "Not linked",
      expenseLink: expenseNumber ? "Linked" : "Not linked"
    }))
  };
}

export function libraryReportFilename(type: LibraryReportType, date = new Date()) {
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return `library-${type}-${localDate}.csv`;
}
