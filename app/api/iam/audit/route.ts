import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_IAM_AUDIT");
  if (auth.response) return auth.response;
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  const events = await prisma.userAudit.findMany({
    where: { action: { startsWith: "IAM_" }, ...(query ? { OR: [{ action: { contains: query } }, { actorName: { contains: query } }] } : {}) },
    select: { action: true, actorName: true, detailsJson: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500
  });
  const response = NextResponse.json({ events: events.map((event) => ({ action: event.action.replaceAll("_", " "), actor: event.actorName, details: safeDetails(event.detailsJson), createdAt: event.createdAt.toISOString() })) });
  response.headers.set("cache-control", "private, no-store");
  return response;
}

function safeDetails(value: string | null) {
  if (!value) return null;
  try {
    const details = JSON.parse(value) as Record<string, unknown>;
    for (const key of Object.keys(details)) if (/id|token|hash|password|credential/i.test(key)) delete details[key];
    return details;
  } catch {
    return null;
  }
}
