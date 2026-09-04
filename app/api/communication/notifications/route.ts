import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCommunicationFeatureForApi } from "@/lib/communication-policy";
import { listOwnCommunicationNotifications, updateOwnCommunicationNotifications } from "@/lib/communication-service";
import { safeClientError } from "@/lib/client-errors";

export async function GET(request: NextRequest) {
  const feature = requireCommunicationFeatureForApi("IN_APP"); if (feature) return feature;
  const auth = await requireApiPermission("VIEW_OWN_NOTIFICATIONS"); if (auth.response) return auth.response;
  const before = request.nextUrl.searchParams.get("before");
  const parsedBefore = before ? new Date(before) : null;
  if (parsedBefore && Number.isNaN(parsedBefore.getTime())) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  return NextResponse.json(await listOwnCommunicationNotifications(prisma, auth.user!.id, { category: request.nextUrl.searchParams.get("category"), before: parsedBefore, limit: Number(request.nextUrl.searchParams.get("limit") ?? 25), archived: request.nextUrl.searchParams.get("view") === "archived" }));
}
export async function PATCH(request: NextRequest) {
  const feature = requireCommunicationFeatureForApi("IN_APP"); if (feature) return feature;
  const auth = await requireApiPermission("ACKNOWLEDGE_OWN_NOTIFICATIONS"); if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const action = String(body.action ?? "").toUpperCase();
    if (!["READ", "ARCHIVE", "MARK_ALL_READ"].includes(action)) return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    const result = await updateOwnCommunicationNotifications(prisma, auth.user!.id, { action: action as "READ" | "ARCHIVE" | "MARK_ALL_READ", itemId: body.itemId });
    return NextResponse.json({ ok: true, result });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update notification.") }, { status: 400 }); }
}
