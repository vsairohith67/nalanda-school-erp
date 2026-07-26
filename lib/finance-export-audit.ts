import type { Prisma, PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { logUserAction } from "@/lib/user-audit";

type ExportAuditClient = Pick<PrismaClient | Prisma.TransactionClient, "userAudit">;

export async function logFinanceExport(
  client: ExportAuditClient,
  input: {
    actor: { id: string; name: string };
    exportType: string;
    purpose: string;
    role: string;
    rowCount: number;
    fields: string[];
    scope: string;
    filename: string;
    from?: string;
    to?: string;
    aggregateOnly?: boolean;
  }
) {
  await logUserAction(client, {
    action: "FINANCE_EXPORT_DOWNLOADED",
    actor: input.actor,
    details: {
      exportType: input.exportType,
      purpose: input.purpose,
      role: input.role,
      rowCount: input.rowCount,
      fields: input.fields,
      scope: input.scope,
      filename: input.filename,
      from: input.from ?? null,
      to: input.to ?? null,
      aggregateOnly: input.aggregateOnly === true
    }
  });
}

export async function auditedFinanceCsvResponse(
  client: ExportAuditClient,
  input: {
    actor: { id: string; name: string };
    role: string;
    exportType: string;
    purpose: string;
    rowCount: number;
    fields: string[];
    scope: string;
    filename: string;
    csv: string;
    from?: string;
    to?: string;
    aggregateOnly?: boolean;
  }
) {
  await logFinanceExport(client, input);
  return new NextResponse(input.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${input.filename}"`,
      "cache-control": "private, no-store",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
      "x-nalanda-export-purpose": input.purpose,
      "x-nalanda-export-row-count": String(input.rowCount)
    }
  });
}
