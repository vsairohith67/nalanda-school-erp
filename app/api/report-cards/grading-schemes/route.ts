import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGradingScheme, publicBand } from "@/lib/report-cards";
import { reportCardApiError } from "@/lib/report-card-api";
import { isKgReportCardOperationallyAvailable } from "@/lib/report-card-release-policy";
export async function GET() { const auth = await requireApiPermission("MANAGE_REPORT_CARD_TEMPLATES"); if (auth.response) return auth.response; const schemes = await prisma.gradingScheme.findMany({ where:{...(!isKgReportCardOperationallyAvailable()?{reportType:"MARK_BASED"}:{})},select: { id:true,schemeCode:true,name:true,academicYear:true,reportType:true,status:true,description:true,bands:{orderBy:{displayOrder:"asc"}} }, orderBy: [{ status: "asc" }, { name: "asc" }] }); return NextResponse.json({ schemes: schemes.map((row) => ({ ...row, bands: row.bands.map(publicBand) })) }); }
export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_REPORT_CARD_TEMPLATES"); if (auth.response) return auth.response; try { return NextResponse.json({ scheme: await createGradingScheme(prisma, await request.json(), auth.user.id) }, { status: 201 }); } catch (error) { return reportCardApiError(error); } }
