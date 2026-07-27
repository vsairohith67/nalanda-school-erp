import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPendingDues } from "@/lib/data";
import { toCsv } from "@/lib/format";
import { requireApiPermission } from "@/lib/auth";
import { buildDetailedReminder } from "@/lib/reminders";
import { getSchoolSettings } from "@/lib/school-settings";
import {
  dailyCollectionExportRow,
  FINANCE_EXPORT_MAX_DAYS,
  FINANCE_EXPORT_ROW_LIMIT,
  parseFinanceDateRange,
  paymentExportRow,
  pendingDuesFinanceRow,
  pendingDuesExportRow,
  pendingDuesViewerAggregate,
  privateFinanceJson,
  studentMasterExportRow
} from "@/lib/finance-privacy";
import { receiptCorrectionDisplay } from "@/lib/receipt";
import {
  effectiveActiveSelectedReceiptPayments,
  loadReceiptStateMap
} from "@/lib/receipt-integrity";
import { logFinanceExport } from "@/lib/finance-export-audit";
import { safeClientError } from "@/lib/client-errors";

const EXPORTS = {
  students: {
    permission: "EXPORT_STUDENTS",
    purpose: "Student-master administration",
    filename: "student-master"
  },
  payments: {
    permission: "EXPORT_PAYMENTS",
    purpose: "Payment ledger reconciliation",
    filename: "payment-ledger"
  },
  "pending-dues": {
    permission: "EXPORT_REPORTS",
    purpose: "Fee due reconciliation",
    filename: "pending-dues"
  },
  "daily-collection": {
    permission: "EXPORT_REPORTS",
    purpose: "Daily collection reconciliation",
    filename: "daily-collection"
  },
  "whatsapp-reminders": {
    permission: "EXPORT_REMINDERS",
    purpose: "Approved pending-dues reminder preparation",
    filename: "pending-dues-reminders"
  }
} as const;

type ExportType = keyof typeof EXPORTS;

export async function GET(request: NextRequest, context: { params: Promise<{ type: string }> }) {
  const { type: rawType } = await context.params;
  if (!(rawType in EXPORTS)) {
    return privateFinanceJson({ error: "Unknown export type" }, { status: 404 });
  }
  const type = rawType as ExportType;
  const contract = EXPORTS[type];
  const auth = await requireApiPermission(contract.permission);
  if (auth.response) return auth.response;
  const sp = request.nextUrl.searchParams;
  try {
    const settings = await getSchoolSettings(prisma);
    const { rows, scope } = await buildExportRows(type, sp, auth.user.role, settings);
    if (rows.length > FINANCE_EXPORT_ROW_LIMIT) {
      return privateFinanceJson({
        error: `Export exceeds ${FINANCE_EXPORT_ROW_LIMIT} rows. Narrow the date or report filters.`
      }, { status: 409 });
    }
    const dateKey = new Date().toISOString().slice(0, 10);
    const filename = `nalanda-${contract.filename}-${scope || dateKey}.csv`;
    const fields = rows.length ? Object.keys(rows[0]) : [];
    await logFinanceExport(prisma, {
      actor: auth.user,
      exportType: type,
      purpose: contract.purpose,
      role: auth.user.role,
      rowCount: rows.length,
      fields,
      scope,
      filename
    });
    return new NextResponse(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store",
        "pragma": "no-cache",
        "x-content-type-options": "nosniff",
        "x-nalanda-export-purpose": contract.purpose,
        "x-nalanda-export-row-count": String(rows.length)
      }
    });
  } catch (error) {
    const message = safeClientError(error, "Unable to prepare finance export");
    const status = /date|range|filter|required|limited/i.test(message) ? 400 : 409;
    return privateFinanceJson({ error: message }, { status });
  }
}

async function buildExportRows(
  type: ExportType,
  sp: URLSearchParams,
  role: string,
  settings: Awaited<ReturnType<typeof getSchoolSettings>>
) {
  if (type === "students") {
    const rows = await prisma.student.findMany({
      where: { deletedAt: null },
      select: {
        academicYear: true,
        admissionNo: true,
        studentName: true,
        className: true,
        section: true,
        rollNo: true,
        status: true,
        studentType: true
      },
      orderBy: { studentName: "asc" },
      take: FINANCE_EXPORT_ROW_LIMIT + 1
    });
    return {
      scope: settings.academicYear,
      rows: rows.map(studentMasterExportRow)
    };
  }

  if (type === "payments") {
    const range = exportDateRange(sp);
    const receiptRows = await prisma.payment.findMany({
      where: {
        deletedAt: null,
        date: { gte: range.from, lt: range.until },
        ...(sp.get("admissionNo") ? { admissionNo: sp.get("admissionNo")! } : {}),
        ...(sp.get("receiptNo") ? { receiptNo: sp.get("receiptNo")! } : {}),
        ...(sp.get("paymentMode") ? { paymentMode: sp.get("paymentMode")! } : {}),
        ...(sp.get("receivedAccount") ? { receivedAccount: sp.get("receivedAccount")! } : {})
      },
      select: {
        id: true,
        date: true,
        receiptNo: true,
        admissionNo: true,
        studentName: true,
        className: true,
        section: true,
        amountPaid: true,
        paymentMode: true,
        receivedAccount: true,
        transactionRefNo: true,
        feeType: true,
        termHint: true,
        isCancelled: true,
        deletedAt: true,
        updatedAt: true
      },
      orderBy: [{ date: "desc" }, { receiptNo: "asc" }],
      take: FINANCE_EXPORT_ROW_LIMIT + 1
    });
    const [states, correctionAudits] = await Promise.all([
      loadReceiptStateMap(
        prisma,
        receiptRows.map((row) => row.receiptNo)
      ),
      prisma.paymentAudit.findMany({
        where: {
          paymentId: { in: receiptRows.map((row) => row.id) },
          action: {
            in: ["RECEIPT_CORRECTED", "RECEIPT_SUPERSEDED", "RECEIPT_REISSUED"]
          }
        },
        select: { paymentId: true, action: true, newValueJson: true }
      })
    ]);
    const auditsByPayment = new Map<string, typeof correctionAudits>();
    for (const audit of correctionAudits) {
      auditsByPayment.set(audit.paymentId, [
        ...(auditsByPayment.get(audit.paymentId) ?? []),
        audit
      ]);
    }
    return {
      scope: range.label,
      rows: receiptRows.map((row) => {
        const status = states.get(row.receiptNo)?.status ?? "INCONSISTENT";
        return paymentExportRow(
          row,
          status,
          receiptCorrectionDisplay(auditsByPayment.get(row.id) ?? [], status)
        );
      })
    };
  }

  if (type === "pending-dues" || type === "whatsapp-reminders") {
    const pending = await getPendingDues({
      academicYear: sp.get("academicYear") || undefined,
      className: sp.get("className") || undefined,
      section: sp.get("section") || undefined,
      status: sp.get("status") || (type === "whatsapp-reminders" ? "Active" : undefined),
      only: type === "whatsapp-reminders"
        ? "pending"
        : (sp.get("only") as "pending" | "paid" | null) || undefined
    });
    const financeRows = pending.filter(Boolean).map((row) =>
      pendingDuesFinanceRow(row as unknown as Record<string, unknown>)
    );
    if (type === "pending-dues") {
      return {
        scope: sp.get("academicYear") || settings.academicYear,
        rows: role === "VIEWER"
          ? pendingDuesViewerAggregate(financeRows)
          : financeRows.slice(0, FINANCE_EXPORT_ROW_LIMIT + 1).map(pendingDuesExportRow)
      };
    }
    const sourceRows = pending.filter((row) => row && row.totalPending > 0);
    return {
      scope: sp.get("academicYear") || settings.academicYear,
      rows: sourceRows.slice(0, FINANCE_EXPORT_ROW_LIMIT + 1).map((row) => {
        if (!row) return {};
        const reminder = {
          academicYear: sp.get("academicYear") || settings.academicYear,
          studentName: row.studentName,
          className: row.className,
          section: row.section,
          totalPending: row.totalPending,
          term1Due: row.term1Due,
          term2Due: row.term2Due,
          term3Due: row.term3Due,
          term4Due: row.term4Due,
          footer: settings.whatsappReminderFooter
        };
        return {
          admissionNo: row.admissionNo,
          studentName: row.studentName,
          className: row.className,
          section: row.section,
          preferredReminderDestination: row.whatsappNumber || row.phone1,
          totalPending: row.totalPending,
          term1Due: row.term1Due,
          term2Due: row.term2Due,
          term3Due: row.term3Due,
          term4Due: row.term4Due,
          message: buildDetailedReminder(reminder)
        };
      })
    };
  }

  const date = parseDate(sp.get("date") || new Date().toISOString().slice(0, 10), "report date");
  const until = new Date(date);
  until.setUTCDate(until.getUTCDate() + 1);
  const receiptRows = await prisma.payment.findMany({
    where: { deletedAt: null, date: { gte: date, lt: until } },
    select: {
      id: true,
      date: true,
      receiptNo: true,
      admissionNo: true,
      studentName: true,
      className: true,
      section: true,
      amountPaid: true,
      paymentMode: true,
      receivedAccount: true,
      transactionRefNo: true,
      feeType: true,
      termHint: true,
      isCancelled: true,
      deletedAt: true,
      updatedAt: true
    },
    orderBy: [{ receiptNo: "asc" }],
    take: FINANCE_EXPORT_ROW_LIMIT + 1
  });
  const activeRows = await effectiveActiveSelectedReceiptPayments(prisma, receiptRows);
  return {
    scope: date.toISOString().slice(0, 10),
    rows: role === "VIEWER"
      ? aggregateCollectionRows(activeRows)
      : activeRows.map(dailyCollectionExportRow)
  };
}

function aggregateCollectionRows(rows: Array<{
  date: Date;
  className: string;
  section: string | null;
  paymentMode: string;
  amountPaid: number;
}>) {
  const grouped = new Map<string, {
    date: string;
    className: string;
    section: string | null;
    paymentMode: string;
    componentCount: number;
    total: number;
  }>();
  for (const row of rows) {
    const date = row.date.toISOString().slice(0, 10);
    const key = `${date}|${row.className}|${row.section ?? ""}|${row.paymentMode}`;
    const value = grouped.get(key) ?? {
      date,
      className: row.className,
      section: row.section,
      paymentMode: row.paymentMode,
      componentCount: 0,
      total: 0
    };
    value.componentCount += 1;
    value.total += row.amountPaid;
    grouped.set(key, value);
  }
  return Array.from(grouped.values());
}

function exportDateRange(sp: URLSearchParams) {
  const range = parseFinanceDateRange(sp.get("from"), sp.get("to"), {
    maxDays: FINANCE_EXPORT_MAX_DAYS
  });
  return {
    from: range.where.gte,
    until: range.where.lt,
    label: `${range.from}-to-${range.to}`
  };
}

function parseDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`A valid ${label} is required`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`A valid ${label} is required`);
  }
  return date;
}
