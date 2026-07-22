import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { createLibraryTitle, libraryTitleInclude, libraryTitleWhere, serializeLibraryTitle } from "@/lib/library-catalog";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_LIBRARY"); if (auth.response) return auth.response;
  const search = Object.fromEntries(request.nextUrl.searchParams);
  const titles = await prisma.libraryTitle.findMany({ where: libraryTitleWhere(search), include: libraryTitleInclude, orderBy: [{ title: "asc" }, { titleCode: "asc" }] });
  return NextResponse.json({ titles: titles.map(serializeLibraryTitle) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_LIBRARY_CATALOG"); if (auth.response) return auth.response;
  try { const title = await createLibraryTitle(prisma, await request.json(), auth.user.id); return NextResponse.json({ title: serializeLibraryTitle(title) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create library title") }, { status: 400 }); }
}
