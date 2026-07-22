import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { incidentInclude, publicIncident } from "@/lib/library-accountability-api";
import { createLibraryIncident } from "@/lib/library-incidents";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("VIEW_LIBRARY_INCIDENTS"); if (auth.response) return auth.response; const status = request.nextUrl.searchParams.get("status"); const type = request.nextUrl.searchParams.get("type"); const rows = await prisma.libraryIncident.findMany({ where: { ...(status ? { status } : {}), ...(type ? { incidentType: type } : {}) }, include: incidentInclude, orderBy: { reportedDate: "desc" } }); return NextResponse.json({ incidents: rows.map((row) => publicIncident(row, auth.user.role === "VIEWER")) }); }
export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_LIBRARY_INCIDENTS"); if (auth.response) return auth.response; try { const incident = await createLibraryIncident(prisma, await request.json(), auth.user.id); return NextResponse.json({ incident: { id: incident.id, incidentNumber: incident.incidentNumber, status: incident.status } }, { status: 201 }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create incident") }, { status: 400 }); } }
