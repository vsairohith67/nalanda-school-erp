import { moneyExact, schoolDateKey } from "@/lib/format";

export type ReceiptLeadershipAction =
  | "CANCELLED"
  | "CORRECTED"
  | "LOCKED_DAY_REVIEW";

export type ReceiptLeadershipActor = {
  id: string;
  name: string;
  role?: string;
};

type ReceiptLeadershipNotificationInput = {
  eventKey: string;
  action: ReceiptLeadershipAction;
  receiptNo: string;
  amount: number;
  receiptDate: Date | string;
  actor: ReceiptLeadershipActor;
  reason: string;
  versionReference?: string | null;
  reconciliationWarning?: string | null;
  now?: Date;
};

const LEADERSHIP_ROLES = ["DIRECTOR", "SUPER_ADMIN"] as const;

export async function publishReceiptLeadershipNotification(
  client: any,
  input: ReceiptLeadershipNotificationInput
) {
  const now = input.now ?? new Date();
  const safe = safeNotificationInput(input);
  const fingerprint = stableEventFingerprint(
    `FIN2B|${input.action}|${input.eventKey}`
  ).slice(0, 24);
  const campaignNumber = `FIN2B-${input.action}-${fingerprint}`;
  const existing = await client.notificationCampaign.findUnique({
    where: { campaignNumber },
    select: { id: true, campaignNumber: true, totalRecipientRows: true }
  });
  if (existing) {
    return {
      campaignNumber: existing.campaignNumber,
      recipients: existing.totalRecipientRows,
      idempotent: true,
      missingLeadership: existing.totalRecipientRows === 0
    };
  }

  const leaders = await client.user.findMany({
    where: {
      isActive: true,
      role: { in: [...LEADERSHIP_ROLES] }
    },
    select: { id: true, role: true },
    orderBy: [{ role: "asc" }, { id: "asc" }]
  });
  const warning = safe.reconciliationWarning
    ? ` Reconciliation warning: ${safe.reconciliationWarning}.`
    : "";
  const actionLabel =
    input.action === "CANCELLED"
      ? "cancelled"
      : input.action === "CORRECTED"
        ? "corrected"
        : "blocked on a protected financial day";
  const title =
    input.action === "LOCKED_DAY_REVIEW"
      ? `Receipt ${safe.receiptNo} needs leadership review`
      : `Receipt ${safe.receiptNo} ${actionLabel}`;
  const body = [
    `Receipt ${safe.receiptNo} was ${actionLabel}.`,
    `Amount ${moneyExact(safe.amount)}; receipt date ${schoolDateKey(safe.receiptDate)}.`,
    `Accountant ${safe.actorName}.`,
    `Reason: ${safe.reason}.`,
    safe.versionReference ? `Version ${safe.versionReference}.` : "",
    `Recorded ${indiaLocalTimestamp(now)}.${warning}`
  ].filter(Boolean).join(" ");
  let campaign: { id: string };
  try {
    campaign = await client.notificationCampaign.create({
      data: {
      campaignNumber,
      category: "FINANCE",
      priority: input.action === "LOCKED_DAY_REVIEW" ? "HIGH" : "NORMAL",
      title,
      body,
      actionLabel: "Open Receipt Audit",
      actionPath: "/receipt-audit",
      audienceType: "SPECIFIC_USERS",
      audienceDefinitionJson: JSON.stringify({ roles: LEADERSHIP_ROLES }),
      audienceSnapshotJson: JSON.stringify({
        roles: LEADERSHIP_ROLES,
        resolvedUsers: leaders.length,
        resolvedAt: now.toISOString(),
        channel: "IN_APP"
      }),
      channel: "IN_APP",
      status: "PUBLISHED",
      acknowledgmentRequired: false,
      totalResolvedUsers: leaders.length,
      totalRecipientRows: leaders.length,
      totalSkipped: leaders.length ? 0 : 1,
      createdByUserId: input.actor.id,
      submittedByUserId: input.actor.id,
      approvedByUserId: input.actor.id,
      publishedByUserId: input.actor.id,
      submittedAt: now,
      approvedAt: now,
        publishedAt: now
      }
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const raced = await client.notificationCampaign.findUnique({
      where: { campaignNumber },
      select: { id: true, campaignNumber: true, totalRecipientRows: true }
    });
    if (!raced) throw error;
    return {
      campaignNumber: raced.campaignNumber,
      recipients: raced.totalRecipientRows,
      idempotent: true,
      missingLeadership: raced.totalRecipientRows === 0
    };
  }
  for (const leader of leaders) {
    await client.notificationRecipient.create({
      data: {
        campaignId: campaign.id,
        userId: leader.id,
        recipientRoleSnapshot: leader.role,
        contextType: "FINANCE_RECEIPT_AUDIT",
        recipientContextJson: JSON.stringify({
          receiptReference: safe.receiptNo,
          action: input.action,
          eventReference: fingerprint
        }),
        deliveryStatus: "AVAILABLE",
        availableAt: now
      }
    });
  }
  if (!leaders.length) {
    await client.notificationSkippedRecipient.create({
      data: {
        campaignId: campaign.id,
        targetType: "LEADERSHIP_ROLES",
        targetReferenceKey: "DIRECTOR_OR_SUPER_ADMIN",
        reasonCode: "NO_ACTIVE_LEADERSHIP_USER",
        safeContextJson: JSON.stringify({
          receiptReference: safe.receiptNo,
          action: input.action
        })
      }
    });
  }
  await client.notificationEvent.create({
    data: {
      campaignId: campaign.id,
      eventType: leaders.length
        ? "FINANCE_RECEIPT_LEADERSHIP_NOTIFIED"
        : "FINANCE_RECEIPT_LEADERSHIP_MISSING",
      newStatus: "PUBLISHED",
      reason: leaders.length
        ? `Resolved ${leaders.length} active leadership recipient(s).`
        : "No active Director or Super Admin exists; the finance action remains preserved with a system warning.",
      recordedByUserId: input.actor.id,
      eventDate: now
    }
  });
  return {
    campaignNumber,
    recipients: leaders.length,
    idempotent: false,
    missingLeadership: leaders.length === 0
  };
}

export function receiptLeadershipEventKey(parts: Array<string | number | null | undefined>) {
  return stableEventFingerprint(
    parts
      .map((part) => String(part ?? ""))
      .map((part) => `${part.length}:${part}`)
      .join("|")
  );
}

function stableEventFingerprint(value: string) {
  // Two independent FNV-1a 64-bit passes keep the browser/server shared module
  // deterministic without importing a Node-only crypto module into client code.
  const hash = (seed: bigint, text: string) => {
    let state = seed;
    for (let index = 0; index < text.length; index += 1) {
      state ^= BigInt(text.charCodeAt(index));
      state = BigInt.asUintN(64, state * 0x100000001b3n);
    }
    return state.toString(16).padStart(16, "0").toUpperCase();
  };
  return `${hash(0xcbf29ce484222325n, value)}${hash(0x84222325cbf29ce4n, `FIN2B:${value}`)}`;
}

function safeNotificationInput(input: ReceiptLeadershipNotificationInput) {
  const receiptNo = safeText(input.receiptNo, "Receipt reference", 80);
  const actorName = privacySafeDisplayLabel(
    safeText(input.actor.name, "Accountant display label", 120)
  );
  const reason = privacySafeReason(
    safeText(input.reason, "Reason", 500)
  );
  const reconciliationWarning = input.reconciliationWarning
    ? safeText(input.reconciliationWarning, "Reconciliation warning", 240)
    : null;
  const versionReference = input.versionReference
    ? safeText(input.versionReference, "Version reference", 200)
    : null;
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
    throw new Error("Receipt amount is invalid for leadership notification.");
  }
  const receiptDate = new Date(input.receiptDate);
  if (!Number.isFinite(receiptDate.getTime())) {
    throw new Error("Receipt date is invalid for leadership notification.");
  }
  return {
    receiptNo,
    actorName,
    reason,
    versionReference,
    reconciliationWarning,
    amount,
    receiptDate
  };
}

function safeText(value: unknown, label: string, maximum: number) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > maximum || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new Error(`${label} must be safe text of at most ${maximum} characters.`);
  }
  return text;
}

function privacySafeReason(value: string) {
  if (
    /(?:aadhaar|aadhar|date\s+of\s+birth|\bdob\b|guardian|father|mother|address|medical|marks?|password|session|mobile|phone|email)/i.test(value) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value) ||
    /\b\d{10,12}\b/.test(value)
  ) {
    return "Sensitive details withheld; review the protected Receipt Audit record";
  }
  return value;
}

function privacySafeDisplayLabel(value: string) {
  if (
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value) ||
    /\b\d{10,12}\b/.test(value) ||
    /(?:password|session|aadhaar|aadhar)/i.test(value)
  ) {
    return "Authorised Accountant";
  }
  return value;
}

function indiaLocalTimestamp(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).format(value);
}

function isUniqueConflict(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
