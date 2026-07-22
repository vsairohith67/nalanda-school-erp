import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { getParentLibraryData, LibraryPortalAccessError } from "@/lib/library-portals";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("VIEW_OWN_LIBRARY_PORTAL"); if (auth.response) return auth.response; try { return NextResponse.json(await getParentLibraryData(prisma, auth.user.id, request.nextUrl.searchParams.get("child"))); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to load Parent Library") }, { status: error instanceof LibraryPortalAccessError ? error.status : 400 }); } }
