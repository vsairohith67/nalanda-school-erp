import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { createLibraryCopy, libraryCopyInclude, libraryCopyWhere, serializeLibraryCopy } from "@/lib/library-accession";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_LIBRARY"); if (auth.response) return auth.response;
  const rows = await prisma.libraryCopy.findMany({ where: libraryCopyWhere(Object.fromEntries(request.nextUrl.searchParams)), include: libraryCopyInclude, orderBy: { accessionNumber: "asc" } });
  return NextResponse.json({ copies: rows.map((row) => serializeLibraryCopy(row, auth.user.role === "VIEWER")) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_LIBRARY_COPIES"); if (auth.response) return auth.response;
  try { const copy = await createLibraryCopy(prisma, await request.json(), auth.user.id); return NextResponse.json({ copy: serializeLibraryCopy(copy) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to accession library copy") }, { status: 400 }); }
}
