import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateNotificationTemplateInput } from "@/lib/notification-templates";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_NOTIFICATION_TEMPLATES");
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const source = await request.json();
    const current = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Notification template was not found" }, { status: 404 });
    if (source.action === "activate" || source.action === "inactivate") {
      const next = source.action === "activate" ? "ACTIVE" : "INACTIVE";
      if (source.action === "activate" && !["DRAFT", "INACTIVE"].includes(current.status)) throw new Error("Only a Draft or Inactive template can be activated.");
      if (source.action === "inactivate" && current.status !== "ACTIVE") throw new Error("Only an Active template can be inactivated.");
      const template = await prisma.$transaction(async (tx) => {
        const updated = await tx.notificationTemplate.update({
          where: { id },
          data: { status: next, activatedByUserId: source.action === "activate" ? auth.user.id : current.activatedByUserId }
        });
        await tx.notificationEvent.create({
          data: {
            templateId: id,
            eventType: source.action === "activate" ? "TEMPLATE_ACTIVATED" : "TEMPLATE_INACTIVATED",
            previousStatus: current.status,
            newStatus: next,
            recordedByUserId: auth.user.id
          }
        });
        return updated;
      });
      return NextResponse.json({ template: safeTemplate(template) });
    }
    if (current.status !== "DRAFT") throw new Error("Only Draft templates can be edited. Inactivate and create a new version for changed wording.");
    const input = validateNotificationTemplateInput(source);
    const template = await prisma.notificationTemplate.update({ where: { id }, data: input });
    return NextResponse.json({ template: safeTemplate(template) });
  } catch (error) {
    return NextResponse.json({ error: message(error, "Unable to update notification template") }, { status: 400 });
  }
}

function safeTemplate(row: any) {
  const { createdByUserId: _createdBy, activatedByUserId: _activatedBy, ...safe } = row;
  return safe;
}
function message(error: unknown, fallback: string) { return safeClientError(error, fallback); }
