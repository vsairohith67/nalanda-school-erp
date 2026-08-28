import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previewCloudBackupRetention, pruneCloudBackupRetention } from "@/lib/cloud-backup-retention";
import { requiresPortableBackupWorker } from "@/lib/cloud-backup-worker";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_CLOUD_BACKUP_RETENTION"); if (auth.response) return auth.response;
  const profileId = request.nextUrl.searchParams.get("profileId") ?? (await prisma.cloudBackupProfile.findFirst({ where: { status: "ACTIVE" } }))?.id;
  if (!profileId) return NextResponse.json({ preview: null }, { headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ preview: await previewCloudBackupRetention(prisma, profileId) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_CLOUD_BACKUP_RETENTION"); if (auth.response) return auth.response;
  try {
    const body = await request.json(), profileId = String(body.profileId ?? "");
    if (body.confirmation !== `APPLY RETENTION ${profileId}`) throw new Error("Exact retention-policy confirmation is required.");
    const keepLatestVerifiedCount = Number(body.keepLatestVerifiedCount), minimumVerifiedCopies = Number(body.minimumVerifiedCopies);
    const keepDailyDays = Number(body.keepDailyDays), keepWeeklyWeeks = Number(body.keepWeeklyWeeks), keepMonthlyMonths = Number(body.keepMonthlyMonths);
    if (!Number.isInteger(keepLatestVerifiedCount) || keepLatestVerifiedCount < 2 || !Number.isInteger(minimumVerifiedCopies) || minimumVerifiedCopies < 2) throw new Error("Retention must preserve at least two latest and two minimum verified copies.");
    if (!Number.isInteger(keepDailyDays) || keepDailyDays < 0 || keepDailyDays > 365
      || !Number.isInteger(keepWeeklyWeeks) || keepWeeklyWeeks < 0 || keepWeeklyWeeks > 260
      || !Number.isInteger(keepMonthlyMonths) || keepMonthlyMonths < 0 || keepMonthlyMonths > 120) {
      throw new Error("Daily, weekly, or monthly retention range is invalid.");
    }
    const policy = await prisma.cloudBackupRetentionPolicy.update({ where: { profileId }, data: {
      keepLatestVerifiedCount, minimumVerifiedCopies,
      keepDailyDays, keepWeeklyWeeks, keepMonthlyMonths,
      autoPruneEnabled: body.autoPruneEnabled === true,
      updatedByUserId: auth.user.id
    } });
    await prisma.cloudBackupEvent.create({ data: { profileId, eventType: "RETENTION_PREVIEWED", safeMetadataJson: JSON.stringify({ keepLatestVerifiedCount, minimumVerifiedCopies, keepDailyDays, keepWeeklyWeeks, keepMonthlyMonths, autoPruneEnabled: policy.autoPruneEnabled }), recordedByUserId: auth.user.id } });
    return NextResponse.json({ policy, preview: await previewCloudBackupRetention(prisma, profileId) });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("PURGE_CLOUD_BACKUPS"); if (auth.response) return auth.response;
  try {
    const body = await request.json(), profileId = String(body.profileId ?? "");
    if (body.confirmation !== `PURGE EXPIRED ${profileId}`) throw new Error("Exact retention purge confirmation is required.");
    const profile = await prisma.cloudBackupProfile.findUnique({ where: { id: profileId } });
    if (!profile) throw new Error("Cloud backup profile was not found.");
    if (requiresPortableBackupWorker(profile)) {
      return NextResponse.json(
        { error: "Portable retention deletion requires the separately authorised backup maintenance job." },
        { status: 409, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    return NextResponse.json(await pruneCloudBackupRetention(prisma, profileId, auth.user.id));
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  return NextResponse.json({ error: safeClientError(error, "Cloud backup retention action failed safely.") }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
}
