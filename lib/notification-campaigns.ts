import { randomUUID } from "node:crypto";
import type { AuthUser } from "@/lib/auth";
import { resolveNotificationAudience, validateAudienceDefinition } from "@/lib/notification-audiences";
import { validateNotificationActionPath } from "@/lib/notification-links";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  optionalPlainText,
  plainText
} from "@/lib/notification-templates";
import { indiaLocalDateKey, requireFutureSchedule } from "@/lib/notification-visibility";
import { recalculateNotificationCounts } from "@/lib/notification-recipients";

export const NOTIFICATION_CAMPAIGN_STATUSES = [
  "DRAFT", "READY_FOR_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED",
  "WITHDRAWN", "CANCELLED", "ARCHIVED"
] as const;
export const NOTIFICATION_CHANNEL = "IN_APP" as const;
export const TEACHER_NOTIFICATION_CATEGORIES = ["ACADEMIC", "HOMEWORK", "GENERAL"] as const;

export type NotificationCampaignInput = {
  templateId: string | null;
  category: string;
  priority: string;
  title: string;
  body: string;
  actionLabel: string | null;
  actionPath: string | null;
  audienceType: string;
  audienceDefinition: Record<string, unknown>;
  acknowledgmentRequired: boolean;
  scheduledFor: Date | null;
  expiresAt: Date | null;
  reviewNotes: string | null;
};

export async function validateNotificationCampaignInput(client: any, input: unknown, actor: Pick<AuthUser, "id" | "role">) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Notification campaign details are required.");
  const source = input as Record<string, unknown>;
  let template: any = null;
  const templateId = optional(source.templateId);
  if (templateId) {
    template = await client.notificationTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.status !== "ACTIVE") throw new Error("Choose an active notification template.");
  }
  const category = allow(source.category ?? template?.category, NOTIFICATION_CATEGORIES, "category");
  const priority = allow(source.priority ?? template?.defaultPriority ?? "NORMAL", NOTIFICATION_PRIORITIES, "priority");
  const title = plainText(source.title ?? template?.titleTemplate, "Notification title", 120);
  const body = plainText(source.body ?? template?.bodyTemplate, "Notification body", 2_000);
  const actionLabel = optionalPlainText(source.actionLabel ?? template?.actionLabel, "Action label", 80);
  const actionPath = validateNotificationActionPath(source.actionPath ?? template?.actionPath);
  if (Boolean(actionLabel) !== Boolean(actionPath)) throw new Error("Action label and action path must be provided together.");
  const audienceType = String(source.audienceType ?? "").trim().toUpperCase();
  const audienceDefinition = validateAudienceDefinition(audienceType, parseDefinition(source.audienceDefinition ?? source.audienceDefinitionJson));
  const scheduledFor = optionalDate(source.scheduledFor, "Scheduled time");
  const expiresAt = optionalDate(source.expiresAt, "Expiry time");
  if (scheduledFor && expiresAt && expiresAt <= scheduledFor) throw new Error("Expiry time must be later than the scheduled time.");
  if (expiresAt && expiresAt <= new Date()) throw new Error("Expiry time must be in the future.");
  if (actor.role === "TEACHER") {
    if (!(TEACHER_NOTIFICATION_CATEGORIES as readonly string[]).includes(category)) {
      throw new Error("Teachers may create only Academic, Homework, or General notifications.");
    }
    if (audienceType !== "TEACHER_TIMETABLE_SCOPE") throw new Error("Teachers may target only their exact timetable scope.");
  }
  return {
    input: {
      templateId,
      category,
      priority,
      title,
      body,
      actionLabel,
      actionPath,
      audienceType,
      audienceDefinition,
      acknowledgmentRequired: source.acknowledgmentRequired === true || template?.acknowledgmentRequired === true,
      scheduledFor,
      expiresAt,
      reviewNotes: optionalPlainText(source.reviewNotes, "Review notes", 1_000)
    } satisfies NotificationCampaignInput,
    templateSnapshot: template ? {
      templateCode: template.templateCode,
      name: template.name,
      versionNumber: template.versionNumber,
      category: template.category,
      defaultPriority: template.defaultPriority,
      titleTemplate: template.titleTemplate,
      bodyTemplate: template.bodyTemplate,
      actionLabel: template.actionLabel,
      actionPath: template.actionPath,
      acknowledgmentRequired: template.acknowledgmentRequired
    } : null
  };
}

export function newNotificationCampaignNumber(now = new Date()) {
  return `NTF-${indiaLocalDateKey(now).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createNotificationCampaign(client: any, source: unknown, actor: AuthUser, correctionOfCampaignId?: string | null) {
  const validated = await validateNotificationCampaignInput(client, source, actor);
  const campaign = await client.notificationCampaign.create({
    data: {
      campaignNumber: newNotificationCampaignNumber(),
      templateId: validated.input.templateId,
      category: validated.input.category,
      priority: validated.input.priority,
      title: validated.input.title,
      body: validated.input.body,
      actionLabel: validated.input.actionLabel,
      actionPath: validated.input.actionPath,
      audienceType: validated.input.audienceType,
      audienceDefinitionJson: JSON.stringify(validated.input.audienceDefinition),
      templateSnapshotJson: validated.templateSnapshot ? JSON.stringify(validated.templateSnapshot) : null,
      channel: NOTIFICATION_CHANNEL,
      status: "DRAFT",
      acknowledgmentRequired: validated.input.acknowledgmentRequired,
      scheduledFor: validated.input.scheduledFor,
      expiresAt: validated.input.expiresAt,
      reviewNotes: validated.input.reviewNotes,
      correctionOfCampaignId: correctionOfCampaignId ?? null,
      createdByUserId: actor.id
    }
  });
  await client.notificationEvent.create({
    data: {
      campaignId: campaign.id,
      eventType: correctionOfCampaignId ? "CORRECTION_CREATED" : "CAMPAIGN_CREATED",
      newStatus: "DRAFT",
      recordedByUserId: actor.id
    }
  });
  return campaign;
}

export async function updateNotificationDraft(client: any, campaignId: string, source: unknown, actor: AuthUser) {
  const current = await client.notificationCampaign.findUnique({ where: { id: campaignId } });
  if (!current) throw new Error("Notification campaign was not found.");
  if (current.status !== "DRAFT") throw new Error("Only Draft notification content and audience can be edited.");
  if (actor.role === "TEACHER" && current.createdByUserId !== actor.id) throw new Error("Teachers may edit only their own drafts.");
  const validated = await validateNotificationCampaignInput(client, source, actor);
  const updated = await client.notificationCampaign.update({
    where: { id: campaignId },
    data: {
      templateId: validated.input.templateId,
      category: validated.input.category,
      priority: validated.input.priority,
      title: validated.input.title,
      body: validated.input.body,
      actionLabel: validated.input.actionLabel,
      actionPath: validated.input.actionPath,
      audienceType: validated.input.audienceType,
      audienceDefinitionJson: JSON.stringify(validated.input.audienceDefinition),
      templateSnapshotJson: validated.templateSnapshot ? JSON.stringify(validated.templateSnapshot) : null,
      acknowledgmentRequired: validated.input.acknowledgmentRequired,
      scheduledFor: validated.input.scheduledFor,
      expiresAt: validated.input.expiresAt,
      reviewNotes: validated.input.reviewNotes
    }
  });
  await client.notificationEvent.create({
    data: { campaignId, eventType: "CAMPAIGN_UPDATED_DRAFT", previousStatus: "DRAFT", newStatus: "DRAFT", recordedByUserId: actor.id }
  });
  return updated;
}

export async function previewNotificationAudience(client: any, campaign: any, actor: AuthUser) {
  if (!["DRAFT", "READY_FOR_REVIEW", "APPROVED"].includes(campaign.status)) throw new Error("This campaign audience is already immutable.");
  if (actor.role === "TEACHER" && campaign.createdByUserId !== actor.id) throw new Error("Teachers may preview only their own scoped campaigns.");
  return resolveNotificationAudience(client, {
    audienceType: campaign.audienceType,
    definition: JSON.parse(campaign.audienceDefinitionJson),
    actor,
    actionPath: campaign.actionPath
  });
}

export async function submitNotificationCampaign(client: any, campaignId: string, actor: AuthUser) {
  const current = await requireCampaignStatus(client, campaignId, "DRAFT");
  if (actor.role === "TEACHER" && current.createdByUserId !== actor.id) throw new Error("Teachers may submit only their own drafts.");
  await previewNotificationAudience(client, current, actor);
  const result = await compareAndSet(client, campaignId, "DRAFT", {
    status: "READY_FOR_REVIEW", submittedByUserId: actor.id, submittedAt: new Date()
  });
  await event(client, campaignId, "CAMPAIGN_SUBMITTED", "DRAFT", "READY_FOR_REVIEW", actor.id);
  return result;
}

export async function approveNotificationCampaign(client: any, campaignId: string, actor: AuthUser) {
  const current = await requireCampaignStatus(client, campaignId, "READY_FOR_REVIEW");
  if (current.createdByUserId === actor.id && actor.role === "TEACHER") throw new Error("Teachers cannot approve their own notification.");
  const result = await compareAndSet(client, campaignId, "READY_FOR_REVIEW", {
    status: "APPROVED", approvedByUserId: actor.id, approvedAt: new Date()
  });
  await event(client, campaignId, "CAMPAIGN_APPROVED", "READY_FOR_REVIEW", "APPROVED", actor.id);
  return result;
}

export async function publishOrScheduleNotificationCampaign(
  prisma: any,
  campaignId: string,
  actor: AuthUser,
  mode: "publish" | "schedule",
  scheduledFor?: Date | null
) {
  return prisma.$transaction(async (tx: any) => {
    const campaign = await requireCampaignStatus(tx, campaignId, "APPROVED");
    const now = new Date();
    const availableAt = mode === "schedule" ? scheduledFor ?? campaign.scheduledFor : now;
    if (mode === "schedule") requireFutureSchedule(availableAt, now);
    if (campaign.expiresAt && campaign.expiresAt <= availableAt) throw new Error("Expiry time must be later than notification availability.");
    const resolutionActor = await notificationAudienceActorForFinalResolution(tx, campaign, actor);
    const resolution = await resolveNotificationAudience(tx, {
      audienceType: campaign.audienceType,
      definition: JSON.parse(campaign.audienceDefinitionJson),
      actor: resolutionActor,
      actionPath: campaign.actionPath
    });
    if (!resolution.recipients.length) throw new Error("No active authenticated users were resolved. The campaign was not published.");
    for (const recipient of resolution.recipients) {
      await tx.notificationRecipient.create({
        data: {
          campaignId,
          userId: recipient.userId,
          recipientRoleSnapshot: recipient.role,
          contextType: recipient.contextType,
          recipientContextJson: JSON.stringify(recipient.context),
          deliveryStatus: mode === "publish" ? "AVAILABLE" : "PENDING",
          availableAt
        }
      });
    }
    for (const skipped of resolution.skipped) {
      await tx.notificationSkippedRecipient.create({
        data: {
          campaignId,
          targetType: skipped.targetType,
          targetReferenceKey: skipped.targetReferenceKey,
          reasonCode: skipped.reasonCode,
          safeContextJson: skipped.safeContext ? JSON.stringify(skipped.safeContext) : null
        }
      });
    }
    const nextStatus = mode === "publish" ? "PUBLISHED" : "SCHEDULED";
    const update = await tx.notificationCampaign.updateMany({
      where: { id: campaignId, status: "APPROVED" },
      data: {
        status: nextStatus,
        audienceSnapshotJson: JSON.stringify({
          definition: JSON.parse(campaign.audienceDefinitionJson),
          summary: resolution.summary,
          resolvedAt: now.toISOString(),
          channel: NOTIFICATION_CHANNEL
        }),
        scheduledFor: mode === "schedule" ? availableAt : campaign.scheduledFor,
        publishedByUserId: mode === "publish" ? actor.id : null,
        publishedAt: mode === "publish" ? now : null
      }
    });
    if (update.count !== 1) throw new Error("Campaign status changed. Refresh and review before continuing.");
    await event(tx, campaignId, mode === "publish" ? "CAMPAIGN_PUBLISHED" : "CAMPAIGN_SCHEDULED", "APPROVED", nextStatus, actor.id);
    await event(tx, campaignId, "RECIPIENTS_RESOLVED", "APPROVED", nextStatus, actor.id, `Resolved ${resolution.recipients.length}; skipped ${resolution.skipped.length}.`);
    return recalculateNotificationCounts(tx, campaignId);
  }, { maxWait: 5_000, timeout: 30_000 });
}

export async function notificationAudienceActorForFinalResolution(
  client: any,
  campaign: { audienceType: string; createdByUserId?: string | null },
  workflowActor: Pick<AuthUser, "id" | "role">
) {
  if (campaign.audienceType !== "TEACHER_TIMETABLE_SCOPE") return workflowActor;
  if (!campaign.createdByUserId) throw new Error("The Teacher-scoped campaign has no preserved creator.");
  const creator = await client.user.findUnique({
    where: { id: campaign.createdByUserId },
    select: { id: true, role: true, isActive: true }
  });
  if (!creator || creator.role !== "TEACHER" || !creator.isActive) {
    throw new Error("The Teacher who created this scoped campaign is no longer an active Teacher user.");
  }
  return creator;
}

export async function transitionNotificationEnding(
  client: any,
  campaignId: string,
  actor: AuthUser,
  action: "withdraw" | "cancel" | "archive",
  reason?: string | null
) {
  const campaign = await client.notificationCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Notification campaign was not found.");
  const now = new Date();
  if (action === "withdraw") {
    const withdrawalReason = plainText(reason, "Withdrawal reason", 1_000);
    if (!["PUBLISHED", "SCHEDULED"].includes(campaign.status)) throw new Error("Only a published or scheduled campaign can be withdrawn.");
    await client.notificationCampaign.update({ where: { id: campaignId }, data: { status: "WITHDRAWN", withdrawalReason, withdrawnByUserId: actor.id, withdrawnAt: now } });
    await client.notificationRecipient.updateMany({ where: { campaignId }, data: { deliveryStatus: "WITHDRAWN" } });
    await event(client, campaignId, "CAMPAIGN_WITHDRAWN", campaign.status, "WITHDRAWN", actor.id, withdrawalReason);
  } else if (action === "cancel") {
    const cancellationReason = plainText(reason, "Cancellation reason", 1_000);
    if (!["DRAFT", "READY_FOR_REVIEW", "APPROVED", "SCHEDULED"].includes(campaign.status)) throw new Error("Only an unpublished campaign can be cancelled.");
    if (campaign.status === "SCHEDULED" && campaign.scheduledFor && campaign.scheduledFor <= now) throw new Error("This scheduled campaign is already available; withdraw it instead.");
    await client.notificationCampaign.update({ where: { id: campaignId }, data: { status: "CANCELLED", cancellationReason, cancelledByUserId: actor.id, cancelledAt: now } });
    await client.notificationRecipient.updateMany({ where: { campaignId }, data: { deliveryStatus: "WITHDRAWN" } });
    await event(client, campaignId, "CAMPAIGN_CANCELLED", campaign.status, "CANCELLED", actor.id, cancellationReason);
  } else {
    if (!["PUBLISHED", "WITHDRAWN"].includes(campaign.status) && !(campaign.expiresAt && campaign.expiresAt <= now)) {
      throw new Error("Only published, withdrawn, or expired campaigns can be archived.");
    }
    await client.notificationCampaign.update({ where: { id: campaignId }, data: { status: "ARCHIVED", archivedByUserId: actor.id, archivedAt: now } });
    await event(client, campaignId, "CAMPAIGN_ARCHIVED", campaign.status, "ARCHIVED", actor.id);
  }
  return client.notificationCampaign.findUnique({ where: { id: campaignId } });
}

export async function createCorrectedNotificationCampaign(client: any, campaignId: string, actor: AuthUser) {
  const original = await client.notificationCampaign.findUnique({ where: { id: campaignId } });
  if (!original || !["PUBLISHED", "WITHDRAWN", "ARCHIVED"].includes(original.status)) {
    throw new Error("A correction can be created only from preserved published history.");
  }
  const futureExpiry = original.expiresAt && original.expiresAt > new Date() ? original.expiresAt : null;
  const corrected = await createNotificationCampaign(client, {
    category: original.category,
    priority: original.priority,
    title: `CORRECTION: ${original.title}`.slice(0, 120),
    body: original.body,
    actionLabel: original.actionLabel,
    actionPath: original.actionPath,
    audienceType: original.audienceType,
    audienceDefinition: JSON.parse(original.audienceDefinitionJson),
    acknowledgmentRequired: original.acknowledgmentRequired,
    expiresAt: futureExpiry
  }, actor, original.id);
  await client.notificationCampaign.update({ where: { id: original.id }, data: { supersededByCampaign: { connect: { id: corrected.id } } } });
  return corrected;
}

async function compareAndSet(client: any, id: string, expectedStatus: string, data: Record<string, unknown>) {
  const updated = await client.notificationCampaign.updateMany({ where: { id, status: expectedStatus }, data });
  if (updated.count !== 1) throw new Error("Campaign status changed. Refresh and review before continuing.");
  return client.notificationCampaign.findUnique({ where: { id } });
}
async function requireCampaignStatus(client: any, id: string, status: string) {
  const campaign = await client.notificationCampaign.findUnique({ where: { id } });
  if (!campaign) throw new Error("Notification campaign was not found.");
  if (campaign.status !== status) throw new Error(`Notification must be ${status.replaceAll("_", " ")} for this action.`);
  return campaign;
}
async function event(client: any, campaignId: string, eventType: string, previousStatus: string, newStatus: string, userId: string, reason?: string) {
  return client.notificationEvent.create({ data: { campaignId, eventType, previousStatus, newStatus, recordedByUserId: userId, reason } });
}
function parseDefinition(value: unknown) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { throw new Error("Audience definition must be valid structured data."); }
}
function optional(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}
function allow<T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  const text = String(value ?? "").trim().toUpperCase();
  if (!(values as readonly string[]).includes(text)) throw new Error(`Choose a valid notification ${label}.`);
  return text as T[number];
}
function optionalDate(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date and time.`);
  return date;
}
