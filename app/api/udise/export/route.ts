import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUdiseChecklist, udiseChecklistCsv, udiseChecklistFilename, udiseSourceRegisterCsv } from "@/lib/udise-checklist";
import { UDISE_PRIVATE_HEADERS } from "@/lib/udise-http";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_UDISE_CHECKLIST");
  if (auth.response) return auth.response;
  const requestedKind = request.nextUrl.searchParams.get("kind") ?? "masked-rows";
  if (requestedKind !== "masked-rows" && requestedKind !== "source-register") {
    return NextResponse.json({ error: "Unsupported UDISE export kind" }, { status: 400, headers: UDISE_PRIVATE_HEADERS });
  }
  const csv = requestedKind === "source-register" ? udiseSourceRegisterCsv() : udiseChecklistCsv(await loadUdiseChecklist(prisma));
  return new NextResponse(csv, { headers: {
    ...UDISE_PRIVATE_HEADERS,
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename=${udiseChecklistFilename(requestedKind)}`,
    "content-security-policy": "sandbox; default-src 'none'"
  } });
}
