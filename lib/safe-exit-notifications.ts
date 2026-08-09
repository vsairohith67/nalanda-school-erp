import { createHash } from "node:crypto";
import { createWhatsAppProvider } from "@/lib/whatsapp-provider";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-phone";

export type SafeExitMaterialEvent = "AWAITING_CONSENT"|"CONSENT_RECORDED"|"APPROVED"|"REJECTED"|"CHECKED_OUT"|"EMERGENCY_OVERRIDE"|"UNAUTHORISED_EXIT"|"RETURNED_TO_CAMPUS"|"CANCELLED";
const CRITICAL = new Set<SafeExitMaterialEvent>(["EMERGENCY_OVERRIDE", "UNAUTHORISED_EXIT"]);

export async function queueSafeExitNotifications(client: any, input: { eventKey: string; eventType: SafeExitMaterialEvent; requestId: string; requestPublicKey: string; actorUserId: string; guardianId?: string | null; parentUserIds?: string[]; leadershipUserIds?: string[]; now?: Date }) {
  const now = input.now ?? new Date();
  const users = [...new Set([...(input.parentUserIds ?? []), ...(input.leadershipUserIds ?? [])])];
  const fingerprint = createHash("sha256").update(`SAFEEXIT1|${input.eventType}|${input.eventKey}`).digest("hex").slice(0,24).toUpperCase();
  const campaignNumber = `SAFEEXIT1-${input.eventType}-${fingerprint}`;
  const copy = notificationCopy(input.eventType);
  let campaign = await client.notificationCampaign.findUnique({ where: { campaignNumber }, select: { id: true } });
  if (!campaign) {
    let created=false;
    try{campaign = await client.notificationCampaign.create({ data: {
        campaignNumber, category: CRITICAL.has(input.eventType) ? "EMERGENCY" : "GENERAL", priority: CRITICAL.has(input.eventType) ? "URGENT" : "HIGH",
        title: copy.title, body: copy.body, actionLabel: copy.actionLabel, actionPath: copy.actionPath,
        audienceType: "SPECIFIC_USERS", audienceDefinitionJson: JSON.stringify({ governedStudentDeparture: true, eventType: input.eventType }),
        audienceSnapshotJson: JSON.stringify({ resolvedUsers: users.length, resolvedAt: now.toISOString(), channel: "IN_APP" }), channel: "IN_APP", status: "PUBLISHED",
        acknowledgmentRequired: CRITICAL.has(input.eventType), totalResolvedUsers: users.length, totalRecipientRows: users.length, totalSkipped: users.length ? 0 : 1,
        createdByUserId: input.actorUserId, submittedByUserId: input.actorUserId, approvedByUserId: input.actorUserId, publishedByUserId: input.actorUserId,
        submittedAt: now, approvedAt: now, publishedAt: now
      } });created=true;
    }catch(error){if((error as {code?:string})?.code!=="P2002")throw error;campaign=await client.notificationCampaign.findUnique({where:{campaignNumber},select:{id:true}});if(!campaign)throw error;}
    if(created){if (!users.length) await client.notificationSkippedRecipient.create({ data: { campaignId: campaign.id, targetType: "STUDENT_DEPARTURE_SCOPE", targetReferenceKey: fingerprint, reasonCode: "NO_ACTIVE_AUTHORISED_USER", safeContextJson: JSON.stringify({ eventType: input.eventType }) } });
      await client.notificationEvent.create({ data: { campaignId: campaign.id, eventType: `SAFE_EXIT_${input.eventType}`, newStatus: "PUBLISHED", reason: users.length ? `Resolved ${users.length} authorised recipient(s).` : "No active authorised recipient was available.", recordedByUserId: input.actorUserId, eventDate: now } });}
  }
  for (const userId of users) {
    const user = await client.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true, lifecycleStatus: true } });
    if (!user || !user.isActive || user.lifecycleStatus !== "ACTIVE") continue;
    await client.notificationRecipient.upsert({ where: { campaignId_userId: { campaignId: campaign.id, userId } }, create: { campaignId: campaign.id, userId, recipientRoleSnapshot: user.role, contextType: "STUDENT_DEPARTURE_PRIVATE", recipientContextJson: JSON.stringify({ requestReference: input.requestPublicKey, eventReference: fingerprint }), deliveryStatus: "AVAILABLE", availableAt: now }, update: {} });
    await client.studentDepartureNotificationOutbox.upsert({ where: { eventKey_recipientUserId_channel: { eventKey: input.eventKey, recipientUserId: userId, channel: "IN_APP" } }, create: { requestId: input.requestId, eventKey: input.eventKey, eventType: input.eventType, recipientUserId: userId, recipientGuardianId: input.guardianId ?? null, channel: "IN_APP", status: "DELIVERED", minimalMessageCode: input.eventType, sentAt: now, deliveredAt: now, providerReferenceSafe: campaignNumber }, update: {} });
    if ((input.parentUserIds ?? []).includes(userId)) for (const channel of ["PUSH", "WHATSAPP"]) await client.studentDepartureNotificationOutbox.upsert({ where: { eventKey_recipientUserId_channel: { eventKey: input.eventKey, recipientUserId: userId, channel } }, create: { requestId: input.requestId, eventKey: input.eventKey, eventType: input.eventType, recipientUserId: userId, recipientGuardianId: input.guardianId ?? null, channel, status: "QUEUED", minimalMessageCode: input.eventType }, update: {} });
  }
  if (CRITICAL.has(input.eventType) && !(input.parentUserIds ?? []).length) await ensureFallbackTask(client, input.requestId, input.eventKey, "NO_ACTIVE_PARENT_ACCOUNT");
  return { campaignNumber, recipients: users.length };
}

export async function processSafeExitNotificationOutbox(client: any, options: { limit?: number; now?: Date } = {}) {
  const now = options.now ?? new Date(), limit = Math.max(1, Math.min(100, options.limit ?? 25));
  const candidates = await client.studentDepartureNotificationOutbox.findMany({ where: { channel: { in: ["PUSH", "WHATSAPP"] }, status: { in: ["QUEUED", "RETRY_PENDING"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, orderBy: [{ nextAttemptAt: "asc" }, { queuedAt: "asc" }], take: limit });
  const summary = { claimed: 0, delivered: 0, retryPending: 0, failed: 0 };
  for (const candidate of candidates) {
    const claim = await client.studentDepartureNotificationOutbox.updateMany({ where: { id: candidate.id, status: candidate.status }, data: { status: "SENDING", claimedAt: now } });
    if (claim.count !== 1) continue;
    summary.claimed++;
    const outcome = candidate.channel === "PUSH" ? await deliverPush(client, candidate) : await deliverWhatsApp(client, candidate);
    const retryCount = candidate.retryCount + 1, retryable = outcome.retryable && retryCount < 3;
    if (outcome.delivered) {
      await client.studentDepartureNotificationOutbox.update({ where: { id: candidate.id }, data: { status: "DELIVERED", retryCount, sentAt: now, deliveredAt: now, claimedAt: null, providerReferenceSafe: outcome.reference, failureCode: null } }); summary.delivered++;
    } else if (retryable) {
      await client.studentDepartureNotificationOutbox.update({ where: { id: candidate.id }, data: { status: "RETRY_PENDING", retryCount, nextAttemptAt: new Date(now.getTime()+retryCount*60_000), claimedAt: null, failureCode: outcome.code } }); summary.retryPending++;
    } else {
      await client.studentDepartureNotificationOutbox.update({ where: { id: candidate.id }, data: { status: "FAILED", retryCount, failedAt: now, claimedAt: null, nextAttemptAt: null, failureCode: outcome.code } }); summary.failed++;
      if (CRITICAL.has(candidate.eventType as SafeExitMaterialEvent)) await ensureFallbackTask(client, candidate.requestId, candidate.eventKey, outcome.code ?? "DELIVERY_FAILED");
    }
  }
  return summary;
}

async function deliverPush(client:any,row:any){const subscription=await client.appPushSubscription.findFirst({where:{userId:row.recipientUserId,status:"ACTIVE",verifiedAt:{not:null}},orderBy:{verifiedAt:"desc"}});if(!subscription)return{delivered:false,retryable:false,code:"NO_ACTIVE_PUSH_SUBSCRIPTION",reference:null};if(subscription.providerMode==="TEST_SINK_FAIL")return{delivered:false,retryable:true,code:"PUSH_TEST_TIMEOUT",reference:null};if(subscription.providerMode!=="TEST_SINK")return{delivered:false,retryable:false,code:"PUSH_LIVE_NOT_AUTHORISED",reference:null};return{delivered:true,retryable:false,code:null,reference:`push.test.${row.publicKey.slice(0,12)}`};}
async function deliverWhatsApp(client:any,row:any){
  if(!row.recipientGuardianId)return{delivered:false,retryable:false,code:"NO_GUARDIAN_SCOPE",reference:null};
  const profile=await client.whatsAppIntegrationProfile.findFirst({where:{mode:"MOCK",status:"ACTIVE",liveSendingEnabled:false},orderBy:{createdAt:"desc"}});if(!profile)return{delivered:false,retryable:false,code:"WHATSAPP_MOCK_PROFILE_UNAVAILABLE",reference:null};
  const mapping=await client.whatsAppTemplateMapping.findFirst({where:{integrationProfileId:profile.id,notificationCategory:"STUDENT_SAFE_EXIT",status:"ACTIVE",providerStatus:"APPROVED"}});if(!mapping)return{delivered:false,retryable:false,code:"WHATSAPP_TEMPLATE_UNAVAILABLE",reference:null};
  const guardian=await client.guardian.findUnique({where:{id:row.recipientGuardianId},select:{primaryMobile:true,status:true}});if(!guardian||guardian.status!=="Active")return{delivered:false,retryable:false,code:"GUARDIAN_UNAVAILABLE",reference:null};
  let phone;try{phone=normalizeWhatsAppPhone(guardian.primaryMobile,{defaultCountryCode:profile.defaultCountryCode,allowDefaultCountryCode:true});}catch{return{delivered:false,retryable:false,code:"GUARDIAN_PHONE_INVALID",reference:null};}
  const consent=await client.whatsAppConsent.findFirst({where:{guardianId:row.recipientGuardianId,subjectType:"GUARDIAN",status:"OPTED_IN",phoneHash:phone.phoneHash,OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}});if(!consent)return{delivered:false,retryable:false,code:"WHATSAPP_CONSENT_UNAVAILABLE",reference:null};
  const result=await createWhatsAppProvider("MOCK").sendApprovedTemplate({to:phone.e164,templateName:mapping.metaTemplateName,languageCode:mapping.metaTemplateLanguage,parameters:[{name:"event",value:"A Student safety update is available in the Nalanda app."}],requestFingerprint:`SAFEEXIT1:${row.eventKey}:${row.recipientUserId}`,opaqueCallbackData:row.publicKey,mockOutcome:process.env.SAFE_EXIT_WHATSAPP_TEST_OUTCOME??null});
  return result.accepted?{delivered:true,retryable:false,code:null,reference:result.providerMessageId}:{delivered:false,retryable:result.retryable,code:result.errorCode??"WHATSAPP_MOCK_FAILED",reference:null};
}
async function ensureFallbackTask(client:any,requestId:string,eventKey:string,reasonCode:string){await client.studentDepartureFallbackTask.upsert({where:{eventKey_taskType:{eventKey,taskType:"DIRECT_PARENT_PHONE_CONTACT"}},create:{requestId,eventKey,taskType:"DIRECT_PARENT_PHONE_CONTACT",reasonCode,assignedRole:"DIRECTOR"},update:{}});}

function notificationCopy(type:SafeExitMaterialEvent){
  const parent={actionLabel:"Open safe exit",actionPath:"/parent/student-departures"};
  if(type==="AWAITING_CONSENT")return{title:"Student departure consent requested",body:"A Student safety request needs your authenticated review. Details are available after sign-in.",...parent};
  if(type==="CONSENT_RECORDED")return{title:"Student departure consent updated",body:"Consent status was recorded for a Student safety request. Details are available after sign-in.",...parent};
  if(type==="APPROVED")return{title:"Student departure approved",body:"A governed Student departure was approved. Details are available after sign-in.",...parent};
  if(type==="REJECTED")return{title:"Student departure not approved",body:"A Student departure request was not approved. Details are available after sign-in.",...parent};
  if(type==="CHECKED_OUT")return{title:"Student checkout completed",body:"A governed campus checkout was completed. Details are available after sign-in.",...parent};
  if(type==="EMERGENCY_OVERRIDE")return{title:"Urgent Student safety update",body:"An urgent Student safety update requires your attention. Sign in for authorised details.",...parent};
  if(type==="UNAUTHORISED_EXIT")return{title:"Urgent Student safety alert",body:"An urgent Student safety alert requires your attention. Sign in for authorised details.",...parent};
  if(type==="RETURNED_TO_CAMPUS")return{title:"Student returned to campus",body:"A return-to-campus update was recorded. Details are available after sign-in.",...parent};
  return{title:"Student departure request cancelled",body:"A Student departure request was cancelled. Details are available after sign-in.",...parent};
}
