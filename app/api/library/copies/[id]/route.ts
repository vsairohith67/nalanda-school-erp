import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { libraryCopyInclude, serializeLibraryCopy, updateLibraryCopyDetails } from "@/lib/library-accession";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_LIBRARY"); if (auth.response) return auth.response;
  const { id } = await context.params; const copy = await prisma.libraryCopy.findUnique({ where: { id }, include: libraryCopyInclude });
  if (!copy) return NextResponse.json({ error: "Library copy not found" }, { status: 404 });
  return NextResponse.json({ copy: serializeLibraryCopy(copy, auth.user.role === "VIEWER") });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_LIBRARY_COPIES"); if (auth.response) return auth.response;
  try { const { id } = await context.params; const body = await request.json(); const copy = await updateLibraryCopyDetails(prisma, id, body, auth.user.id, body.correctionReason); return NextResponse.json({ copy: serializeLibraryCopy(copy) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update library copy") }, { status: 400 }); }
}
