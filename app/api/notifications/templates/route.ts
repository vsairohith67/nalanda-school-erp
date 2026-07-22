import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationTemplateErrorMessage, validateNotificationTemplateInput } from "@/lib/notification-templates";

export async function GET() {
  const auth = await requireApiPermission("MANAGE_NOTIFICATION_TEMPLATES");
  if (auth.response) return auth.response;
  const templates = await prisma.notificationTemplate.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
  return NextResponse.json({ templates: templates.map(safeTemplate) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_NOTIFICATION_TEMPLATES");
  if (auth.response) return auth.response;
  try {
    const input = validateNotificationTemplateInput(await request.json());
    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.notificationTemplate.create({ data: { ...input, createdByUserId: auth.user.id } });
      await tx.notificationEvent.create({ data: { templateId: created.id, eventType: "TEMPLATE_CREATED", newStatus: "DRAFT", recordedByUserId: auth.user.id } });
      return created;
    });
    return NextResponse.json({ template: safeTemplate(template) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: notificationTemplateErrorMessage(error, "Unable to create notification template") }, { status: 400 });
  }
}

function safeTemplate(row: any) {
  const { createdByUserId: _createdBy, activatedByUserId: _activatedBy, ...safe } = row;
  return safe;
}
