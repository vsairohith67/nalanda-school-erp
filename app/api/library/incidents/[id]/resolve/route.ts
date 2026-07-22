import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { resolveLibraryIncident } from "@/lib/library-incidents";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("MANAGE_LIBRARY_INCIDENTS"); if (auth.response) return auth.response; try { const row = await resolveLibraryIncident(prisma, (await params).id, await request.json(), auth.user.id); return NextResponse.json({ incident: { incidentNumber: row.incidentNumber, status: row.status, resolutionType: row.resolutionType } }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to resolve incident") }, { status: 400 }); } }
