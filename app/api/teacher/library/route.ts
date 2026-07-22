import { safeClientError } from "@/lib/client-errors";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { getTeacherLibraryData, LibraryPortalAccessError } from "@/lib/library-portals";
import { prisma } from "@/lib/prisma";
export async function GET() { const auth = await requireApiPermission("VIEW_OWN_LIBRARY_PORTAL"); if (auth.response) return auth.response; try { return NextResponse.json(await getTeacherLibraryData(prisma, auth.user.id)); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to load Teacher Library") }, { status: error instanceof LibraryPortalAccessError ? error.status : 400 }); } }
