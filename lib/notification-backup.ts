type Row = Record<string, unknown>;

const TEMPLATE_KEYS = new Set(["id","templateCode","name","category","defaultPriority","titleTemplate","bodyTemplate","actionLabel","actionPath","acknowledgmentRequired","status","versionNumber","createdAt","updatedAt"]);
const CAMPAIGN_KEYS = new Set(["id","campaignNumber","templateId","category","priority","title","body","actionLabel","actionPath","audienceType","audienceDefinitionJson","audienceSnapshotJson","templateSnapshotJson","channel","status","acknowledgmentRequired","scheduledFor","expiresAt","totalResolvedUsers","totalRecipientRows","totalSkipped","totalRead","totalAcknowledged","totalDismissed","correctionOfCampaignId","reviewNotes","withdrawalReason","cancellationReason","submittedAt","approvedAt","publishedAt","withdrawnAt","cancelledAt","archivedAt","createdAt","updatedAt"]);
const RECIPIENT_KEYS = new Set(["id","campaignId","userId","recipientRoleSnapshot","contextType","recipientContextJson","deliveryStatus","availableAt","firstViewedAt","readAt","acknowledgedAt","dismissedAt","expiredAt","createdAt","updatedAt"]);
const SKIPPED_KEYS = new Set(["id","campaignId","targetType","targetReferenceKey","reasonCode","safeContextJson","createdAt"]);
const EVENT_KEYS = new Set(["id","templateId","campaignId","recipientId","eventType","eventDate","previousStatus","newStatus","reason","notes","createdAt"]);
const CONTACT_PATTERN = /(?:phone|mobile|whatsapp|email|password|secret|credential)/i;

export function validateNotificationBackupRows(source: Record<string, unknown>, context: { userIds: Set<string> }) {
  const notificationTemplates = rows(source.notificationTemplates, "notificationTemplates", TEMPLATE_KEYS);
  const notificationCampaigns = rows(source.notificationCampaigns, "notificationCampaigns", CAMPAIGN_KEYS);
  const notificationRecipients = rows(source.notificationRecipients, "notificationRecipients", RECIPIENT_KEYS);
  const notificationSkippedRecipients = rows(source.notificationSkippedRecipients, "notificationSkippedRecipients", SKIPPED_KEYS);
  const notificationEvents = rows(source.notificationEvents, "notificationEvents", EVENT_KEYS);
  const templateIds = unique(notificationTemplates, "id", "template identity");
  unique(notificationTemplates, "templateCode", "template code", (value) => value.toUpperCase());
  const campaignIds = unique(notificationCampaigns, "id", "campaign identity");
  unique(notificationCampaigns, "campaignNumber", "campaign number", (value) => value.toUpperCase());
  const recipientIds = unique(notificationRecipients, "id", "recipient identity");
  const campaignUsers = new Set<string>();
  const eventIds = new Set<string>();

  for (const [index, row] of notificationCampaigns.entries()) {
    const prefix = `notificationCampaigns[${index}]`;
    if (String(row.channel) !== "IN_APP") throw new Error(`${prefix}.channel must be IN_APP`);
    if (row.templateId && !templateIds.has(String(row.templateId))) throw new Error(`${prefix}.templateId is invalid`);
    if (row.correctionOfCampaignId && !campaignIds.has(String(row.correctionOfCampaignId))) throw new Error(`${prefix}.correctionOfCampaignId is invalid`);
    if (row.correctionOfCampaignId === row.id) throw new Error(`${prefix} cannot correct itself`);
    assertSafeJson(row.audienceDefinitionJson, `${prefix}.audienceDefinitionJson`);
    assertSafeJson(row.audienceSnapshotJson, `${prefix}.audienceSnapshotJson`);
    assertSafeJson(row.templateSnapshotJson, `${prefix}.templateSnapshotJson`);
  }
  const corrections = notificationCampaigns.map((row) => String(row.correctionOfCampaignId ?? "")).filter(Boolean);
  if (new Set(corrections).size !== corrections.length) throw new Error("notificationCampaigns contains duplicate correction links");

  for (const [index, row] of notificationRecipients.entries()) {
    const prefix = `notificationRecipients[${index}]`;
    const campaignId = required(row.campaignId, `${prefix}.campaignId`);
    const userId = required(row.userId, `${prefix}.userId`);
    if (!campaignIds.has(campaignId)) throw new Error(`${prefix}.campaignId is invalid`);
    if (!context.userIds.has(userId)) throw new Error(`${prefix}.userId does not match a backup User`);
    const key = `${campaignId}|${userId}`;
    if (campaignUsers.has(key)) throw new Error(`${prefix} duplicates a campaign/user recipient`);
    campaignUsers.add(key);
    assertSafeJson(row.recipientContextJson, `${prefix}.recipientContextJson`);
  }
  for (const [index, row] of notificationSkippedRecipients.entries()) {
    const prefix = `notificationSkippedRecipients[${index}]`;
    if (!campaignIds.has(required(row.campaignId, `${prefix}.campaignId`))) throw new Error(`${prefix}.campaignId is invalid`);
    assertSafeJson(row.safeContextJson, `${prefix}.safeContextJson`);
  }
  for (const [index, row] of notificationEvents.entries()) {
    const prefix = `notificationEvents[${index}]`;
    const id = required(row.id, `${prefix}.id`);
    if (eventIds.has(id)) throw new Error(`${prefix}.id is duplicated`);
    eventIds.add(id);
    if (row.templateId && !templateIds.has(String(row.templateId))) throw new Error(`${prefix}.templateId is invalid`);
    if (row.campaignId && !campaignIds.has(String(row.campaignId))) throw new Error(`${prefix}.campaignId is invalid`);
    if (row.recipientId && !recipientIds.has(String(row.recipientId))) throw new Error(`${prefix}.recipientId is invalid`);
  }
  return { notificationTemplates, notificationCampaigns, notificationRecipients, notificationSkippedRecipients, notificationEvents };
}

function rows(value: unknown, name: string, allowed: Set<string>) {
  if (value === undefined || value === null) return [] as Row[];
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${name}[${index}] must be an object`);
    const row = item as Row;
    for (const key of Object.keys(row)) if (!allowed.has(key)) throw new Error(`${name}[${index}] contains unsupported field ${key}`);
    required(row.id, `${name}[${index}].id`);
    return row;
  });
}
function unique(rows: Row[], key: string, label: string, normalize: (value: string) => string = (value) => value) {
  const values = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const value = normalize(required(row[key], `${label} at row ${index + 1}`));
    if (values.has(value)) throw new Error(`Notification backup contains duplicate ${label}`);
    values.add(value);
  }
  return values;
}
function required(value: unknown, field: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required`);
  return text;
}
function assertSafeJson(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return;
  let parsed: unknown;
  try { parsed = JSON.parse(String(value)); } catch { throw new Error(`${field} must be valid JSON`); }
  visit(parsed, field);
}
function visit(value: unknown, field: string) {
  if (Array.isArray(value)) return value.forEach((item) => visit(item, field));
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (CONTACT_PATTERN.test(key)) throw new Error(`${field} contains forbidden contact or credential field ${key}`);
    visit(item, field);
  }
}
