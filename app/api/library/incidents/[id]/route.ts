import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { incidentInclude, publicIncident } from "@/lib/library-accountability-api";
import { prisma } from "@/lib/prisma";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("VIEW_LIBRARY_INCIDENTS"); if (auth.response) return auth.response; const row = await prisma.libraryIncident.findUnique({ where: { id: (await params).id }, include: incidentInclude }); if (!row) return NextResponse.json({ error: "Library incident not found" }, { status: 404 }); return NextResponse.json({ incident: publicIncident(row, auth.user.role === "VIEWER") }); }
