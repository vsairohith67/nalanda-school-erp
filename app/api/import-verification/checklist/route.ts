import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { validateGoLiveChecklist } from "@/lib/go-live-checklist";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_IMPORT_VERIFICATION");
  if (auth.response) return auth.response;
  try {
    const checklist = validateGoLiveChecklist(await request.json());
    const saved = await prisma.goLiveChecklist.upsert({
      where: { id: "go-live" },
      update: { ...checklist, updatedBy: auth.user.name },
      create: { id: "go-live", ...checklist, updatedBy: auth.user.name }
    });
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json({ error: "Unable to save the go-live checklist" }, { status: 400 });
  }
}
