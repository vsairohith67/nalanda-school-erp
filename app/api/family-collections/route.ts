import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { privateFinanceJson } from "@/lib/finance-privacy";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_FAMILY_COLLECTIONS");
  if (auth.response) return auth.response;
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const dateWhere = dateRange(from, to);
  if (auth.user.role === "VIEWER") {
    const rows = await prisma.familyCollection.groupBy({
      by: ["status"],
      where: dateWhere ? { collectionDate: dateWhere } : undefined,
      _count: { _all: true },
      _sum: { totalPaise: true },
      orderBy: { status: "asc" }
    });
    return privateFinanceJson({ aggregateOnly: true, rows: rows.map((row) => ({ status: row.status, collections: row._count._all, totalPaise: row._sum.totalPaise ?? 0 })) });
  }
  const rows = await prisma.familyCollection.findMany({
    where: dateWhere ? { collectionDate: dateWhere } : undefined,
    select: { publicReference: true, collectionDate: true, status: true, totalPaise: true, version: true, payerType: true, payerDisplayName: true, _count: { select: { allocations: true, instruments: true } } },
    orderBy: [{ collectionDate: "desc" }, { createdAt: "desc" }],
    take: 500
  });
  return privateFinanceJson({ aggregateOnly: false, rows });
}

function dateRange(from: string | null, to: string | null) {
  if (!from && !to) return null;
  if ((from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) || (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))) return null;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lt: new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000) } : {})
  };
}
