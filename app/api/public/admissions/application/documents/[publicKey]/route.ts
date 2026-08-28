import { NextRequest, NextResponse } from "next/server";
import { admissionsError, ADMISSIONS_PRIVATE_HEADERS, invitationToken } from "@/lib/admissions-api";
import { retrieveApplicationDocument } from "@/lib/admissions-files";
import { prisma } from "@/lib/prisma";
import { PUBLIC_ADMISSIONS_FORM_FEATURE, requireOperationalReleaseFeatureForApi } from "@/lib/release-feature-flag-runtime";
export async function GET(request: NextRequest, context: { params: Promise<{ publicKey: string }> }) { const featureUnavailable = requireOperationalReleaseFeatureForApi(PUBLIC_ADMISSIONS_FORM_FEATURE); if (featureUnavailable) return featureUnavailable; try { const row = await retrieveApplicationDocument(prisma, (await context.params).publicKey, { invitationToken: invitationToken(request) }); return new NextResponse(new Uint8Array(row.bytes), { headers: { ...ADMISSIONS_PRIVATE_HEADERS, "Content-Type": row.document.mediaType, "Content-Length": String(row.document.byteSize), "Content-Disposition": `attachment; filename="${row.document.safeDisplayName.replace(/["\\\r\n]/g, "")}"`, "X-Document-SHA256": row.document.sha256 } }); } catch (error) { return admissionsError(error); } }
