import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicWebsiteSettingsWorkflow, savePublicWebsiteSettings } from "@/lib/public-website-content";
import { PRIVATE_NO_STORE, publicWebsiteApiFailure } from "@/lib/public-website-api";

export async function GET() {
  const auth = await requireApiPermission("MANAGE_PUBLIC_WEBSITE_SETTINGS"); if (auth.response) return auth.response;
  return NextResponse.json({ settings: await prisma.publicWebsiteSettings.findMany({ orderBy: { updatedAt: "desc" } }) }, { headers: PRIVATE_NO_STORE });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_PUBLIC_WEBSITE_SETTINGS"); if (auth.response) return auth.response;
  try { return NextResponse.json({ settings: await savePublicWebsiteSettings(prisma, await request.json(), auth.user.id) }, { status: 201, headers: PRIVATE_NO_STORE }); }
  catch (error) { return publicWebsiteApiFailure(error); }
}
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({})), action = String(body.action ?? "");
  const permission = action === "approve" ? "REVIEW_PUBLIC_WEBSITE_CONTENT" : action === "publish" ? "PUBLISH_PUBLIC_WEBSITE_CONTENT" : "MANAGE_PUBLIC_WEBSITE_SETTINGS";
  const auth = await requireApiPermission(permission); if (auth.response) return auth.response;
  try {
    const latest = body.id ? null : await prisma.publicWebsiteSettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { id: true } });
    return NextResponse.json({ settings: await publicWebsiteSettingsWorkflow(prisma, String(body.id ?? latest?.id ?? ""), action, auth.user.id) }, { headers: PRIVATE_NO_STORE });
  }
  catch (error) { return publicWebsiteApiFailure(error); }
}
