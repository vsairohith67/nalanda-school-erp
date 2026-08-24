import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyMarksImport, previewMarksImport } from "@/lib/marks-import";
import { marksError } from "@/lib/marks-api";
import { REAL_DATA_IMPORTS_FEATURE, requireOperationalReleaseFeatureForApi } from "@/lib/release-feature-flag-runtime";
export async function POST(request: NextRequest) { const auth = await requireApiPermission("ENTER_MARKS"); if (auth.response || !auth.user) return auth.response; try { const body = await request.json(); if (body.action === "preview") return NextResponse.json({ preview: await previewMarksImport(prisma, auth.user, body.csv) }); const featureUnavailable = requireOperationalReleaseFeatureForApi(REAL_DATA_IMPORTS_FEATURE); if (featureUnavailable) return featureUnavailable; if (body.action === "confirm") return NextResponse.json({ result: await applyMarksImport(prisma, auth.user, body.csv, { id: auth.user.id, name: auth.user.name }) }); return NextResponse.json({ error: "Choose preview or confirm." }, { status: 400 }); } catch (error) { const r = marksError(error); return NextResponse.json({ error: r.message }, { status: r.status }); } }
