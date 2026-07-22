import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CLOUD_BACKUP_TIMEZONE, nextCloudBackupDueAt, validateCloudBackupSchedule } from "@/lib/cloud-backup-schedules";

export async function GET() {
  const auth = await requireApiPermission("MANAGE_CLOUD_BACKUP_SCHEDULES"); if (auth.response) return auth.response;
  return NextResponse.json({ schedules: await prisma.cloudBackupSchedule.findMany({ include: { profile: true }, orderBy: { scheduleCode: "asc" } }) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_CLOUD_BACKUP_SCHEDULES"); if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const scheduleCode = String(body.scheduleCode ?? "").trim().toUpperCase();
    if (!/^QA20C-[A-Z0-9-]{3,40}$/.test(scheduleCode)) throw new Error("Schedule code must use a QA20C prefix.");
    const shape = scheduleShape(body);
    validateCloudBackupSchedule(shape as any);
    const enabled = body.enabled === true;
    const schedule = await prisma.cloudBackupSchedule.create({ data: {
      scheduleCode,
      profileId: String(body.profileId ?? ""),
      ...shape,
      enabled,
      nextRunAt: enabled ? nextCloudBackupDueAt(shape as any) : null,
      createdByUserId: auth.user.id,
      updatedByUserId: auth.user.id
    } });
    await prisma.cloudBackupEvent.create({ data: { profileId: schedule.profileId, scheduleId: schedule.id, eventType: "SCHEDULE_CREATED", recordedByUserId: auth.user.id } });
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_CLOUD_BACKUP_SCHEDULES"); if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const existing = await prisma.cloudBackupSchedule.findUnique({ where: { id: String(body.id ?? "") } });
    if (!existing) return NextResponse.json({ error: "Cloud backup schedule not found." }, { status: 404 });
    const enabled = body.enabled === true;
    const nextRunAt = enabled ? nextCloudBackupDueAt(existing, new Date()) : null;
    const schedule = await prisma.cloudBackupSchedule.update({ where: { id: existing.id }, data: { enabled, nextRunAt, updatedByUserId: auth.user.id } });
    await prisma.cloudBackupEvent.create({ data: { profileId: existing.profileId, scheduleId: existing.id, eventType: "SCHEDULE_UPDATED", safeMetadataJson: JSON.stringify({ enabled }), recordedByUserId: auth.user.id } });
    return NextResponse.json({ schedule });
  } catch (error) { return failure(error); }
}

function scheduleShape(body: any) {
  return {
    frequency: String(body.frequency ?? "DAILY").toUpperCase(),
    intervalCount: Number(body.intervalCount ?? 1),
    hourOfDay: body.hourOfDay == null ? null : Number(body.hourOfDay),
    minuteOfHour: body.minuteOfHour == null ? 0 : Number(body.minuteOfHour),
    dayOfWeek: body.dayOfWeek == null ? null : Number(body.dayOfWeek),
    dayOfMonth: body.dayOfMonth == null ? null : Number(body.dayOfMonth),
    timezone: CLOUD_BACKUP_TIMEZONE,
    catchUpPolicy: body.catchUpPolicy === "RUN_ONE_MISSED" ? "RUN_ONE_MISSED" : "SKIP_MISSED"
  };
}

function failure(error: unknown) {
  return NextResponse.json({ error: safeClientError(error, "Cloud backup schedule action failed safely.") }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
}
