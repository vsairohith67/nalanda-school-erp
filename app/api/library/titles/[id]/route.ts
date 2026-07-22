import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { libraryCopyInclude, serializeLibraryCopy } from "@/lib/library-accession";
import { libraryTitleInclude, serializeLibraryTitle, updateLibraryTitle } from "@/lib/library-catalog";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_LIBRARY"); if (auth.response) return auth.response;
  const { id } = await context.params; const title = await prisma.libraryTitle.findUnique({ where: { id }, include: { ...libraryTitleInclude, copies: { include: libraryCopyInclude, orderBy: { accessionNumber: "asc" } } } });
  if (!title) return NextResponse.json({ error: "Library title not found" }, { status: 404 });
  return NextResponse.json({ title: serializeLibraryTitle(title), copies: title.copies.map((copy) => serializeLibraryCopy(copy, auth.user.role === "VIEWER")) });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_LIBRARY_CATALOG"); if (auth.response) return auth.response;
  try { const { id } = await context.params; const title = await updateLibraryTitle(prisma, id, await request.json()); return NextResponse.json({ title: serializeLibraryTitle(title) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update library title") }, { status: 400 }); }
}
