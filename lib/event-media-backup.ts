import type { PrismaClient } from "@prisma/client";
import { databaseTableExists } from "@/lib/database-capabilities";

export const EVENT_MEDIA_BACKUP_KEYS = ["eventMediaAlbums", "eventMediaAssets", "eventMediaDerivatives", "eventMediaStudentAssociations", "mediaPublicationConsents", "eventMediaAuditEvents"] as const;
export type EventMediaBackupKey = (typeof EVENT_MEDIA_BACKUP_KEYS)[number];
export type EventMediaBackup = Record<EventMediaBackupKey, Record<string, unknown>[]>;
type Result = Record<EventMediaBackupKey, { created: number; updated: number; skipped: number; errors: string[] }> & { warnings: string[] };

const FIELDS: Record<EventMediaBackupKey, Set<string>> = {
  eventMediaAlbums: new Set(["id","publicKey","title","eventDate","description","visibility","status","reviewStatus","publicationState","coverAssetPublicKey","retentionPolicy","retentionReviewAt","legalHold","createdByUserId","reviewedByUserId","approvedByUserId","publishedByUserId","unpublishedByUserId","archivedByUserId","reviewedAt","approvedAt","publishedAt","unpublishedAt","archivedAt","rowVersion","createdAt","updatedAt"]),
  eventMediaAssets: new Set(["id","publicKey","albumId","originalStorageKey","originalMediaType","originalExtension","originalByteSize","originalSha256","originalWidth","originalHeight","uploadActorUserId","uploadedAt","reviewStatus","reviewedByUserId","reviewedAt","reviewNote","caption","peopleDeclaration","publicationEligibility","publicationStatus","withdrawalState","withdrawalReason","withdrawnAt","derivativeStatus","recoveryStatus","backupArtifactSha256","backupKeyVersion","backupVerifiedAt","archivedAt","rowVersion","createdAt","updatedAt"]),
  eventMediaDerivatives: new Set(["id","publicKey","assetId","kind","status","storageKey","mediaType","extension","byteSize","sha256","width","height","metadataStripped","failureCode","createdAt"]),
  eventMediaStudentAssociations: new Set(["id","assetId","studentId","associatedByUserId","associatedAt"]),
  mediaPublicationConsents: new Set(["id","publicKey","studentId","guardianId","audience","status","purposeScope","wordingVersion","source","evidenceReference","grantedAt","expiresAt","revokedAt","recordedByUserId","revokedByUserId","revocationReason","createdAt","updatedAt"]),
  eventMediaAuditEvents: new Set(["id","publicKey","albumId","assetId","consentId","eventType","actorUserId","actorRole","previousState","newState","reason","safeMetadataJson","eventDate","createdAt"])
};
const REQUIRED: Record<EventMediaBackupKey, string[]> = {
  eventMediaAlbums: ["id","publicKey","title","eventDate","visibility","status","reviewStatus","publicationState","retentionPolicy","createdByUserId","rowVersion"],
  eventMediaAssets: ["id","publicKey","albumId","originalStorageKey","originalMediaType","originalExtension","originalByteSize","originalSha256","originalWidth","originalHeight","uploadActorUserId","uploadedAt","reviewStatus","peopleDeclaration","publicationEligibility","publicationStatus","withdrawalState","derivativeStatus","recoveryStatus","rowVersion"],
  eventMediaDerivatives: ["id","publicKey","assetId","kind","status","metadataStripped"],
  eventMediaStudentAssociations: ["id","assetId","studentId","associatedByUserId","associatedAt"],
  mediaPublicationConsents: ["id","publicKey","studentId","audience","status","purposeScope","wordingVersion","source","evidenceReference","grantedAt","recordedByUserId"],
  eventMediaAuditEvents: ["id","publicKey","eventType","actorUserId","actorRole","eventDate"]
};

export function emptyEventMediaBackup(): EventMediaBackup { return Object.fromEntries(EVENT_MEDIA_BACKUP_KEYS.map((key) => [key, []])) as unknown as EventMediaBackup; }

export async function eventMediaSchemaAvailable(client: PrismaClient) {
  try { if (!(client as any).eventMediaAlbum?.findMany) return false; return await databaseTableExists(client, "EventMediaAlbum"); }
  catch { return false; }
}

export async function loadEventMediaBackup(client: PrismaClient): Promise<EventMediaBackup> {
  const db = client as any;
  const [albums, assets, derivatives, associations, consents, audits] = await Promise.all([
    db.eventMediaAlbum.findMany({ orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] }),
    db.eventMediaAsset.findMany({ orderBy: [{ albumId: "asc" }, { createdAt: "asc" }] }),
    db.eventMediaDerivative.findMany({ orderBy: [{ assetId: "asc" }, { kind: "asc" }] }),
    db.eventMediaStudentAssociation.findMany({ orderBy: [{ assetId: "asc" }, { studentId: "asc" }] }),
    db.mediaPublicationConsent.findMany({ orderBy: [{ studentId: "asc" }, { grantedAt: "asc" }] }),
    db.eventMediaAuditEvent.findMany({ orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] })
  ]);
  return { eventMediaAlbums: albums, eventMediaAssets: assets, eventMediaDerivatives: derivatives, eventMediaStudentAssociations: associations, mediaPublicationConsents: consents, eventMediaAuditEvents: audits };
}

export function validateEventMediaBackupRows(root: Record<string, unknown>): EventMediaBackup {
  const result = Object.fromEntries(EVENT_MEDIA_BACKUP_KEYS.map((key) => [key, rows(root[key], key, FIELDS[key], REQUIRED[key])])) as EventMediaBackup;
  const albumIds = unique(result.eventMediaAlbums, "eventMediaAlbums", "id"); unique(result.eventMediaAlbums, "eventMediaAlbums", "publicKey");
  const assetIds = unique(result.eventMediaAssets, "eventMediaAssets", "id"); unique(result.eventMediaAssets, "eventMediaAssets", "publicKey");
  const consentIds = unique(result.mediaPublicationConsents, "mediaPublicationConsents", "id"); unique(result.mediaPublicationConsents, "mediaPublicationConsents", "publicKey");
  unique(result.eventMediaDerivatives, "eventMediaDerivatives", "id"); unique(result.eventMediaDerivatives, "eventMediaDerivatives", "publicKey");
  unique(result.eventMediaStudentAssociations, "eventMediaStudentAssociations", "id"); unique(result.eventMediaAuditEvents, "eventMediaAuditEvents", "id"); unique(result.eventMediaAuditEvents, "eventMediaAuditEvents", "publicKey");
  for (const [index, row] of result.eventMediaAlbums.entries()) {
    oneOf(row.visibility, ["PRIVATE_LEADERSHIP","INTERNAL_AUTHORISED","PARENT_PORTAL","PUBLIC"], `eventMediaAlbums[${index}].visibility`);
    oneOf(row.status, ["DRAFT","PRIVATE","UNDER_REVIEW","APPROVED","PUBLISHED","ARCHIVED"], `eventMediaAlbums[${index}].status`);
    positive(row.rowVersion, `eventMediaAlbums[${index}].rowVersion`); date(row.eventDate, `eventMediaAlbums[${index}].eventDate`);
  }
  for (const [index, row] of result.eventMediaAssets.entries()) {
    if (!albumIds.has(text(row.albumId))) throw new Error(`eventMediaAssets[${index}] has an invalid album link`);
    if (!/^original\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.(?:png|jpg|webp)$/.test(text(row.originalStorageKey))) throw new Error(`eventMediaAssets[${index}].originalStorageKey is invalid`);
    oneOf(row.originalMediaType, ["image/png","image/jpeg","image/webp"], `eventMediaAssets[${index}].originalMediaType`);
    hash(row.originalSha256, `eventMediaAssets[${index}].originalSha256`); positive(row.originalByteSize, `eventMediaAssets[${index}].originalByteSize`); positive(row.originalWidth, `eventMediaAssets[${index}].originalWidth`); positive(row.originalHeight, `eventMediaAssets[${index}].originalHeight`); positive(row.rowVersion, `eventMediaAssets[${index}].rowVersion`);
    oneOf(row.peopleDeclaration, ["UNKNOWN","NO_STUDENTS","MANUAL_ASSOCIATIONS_COMPLETE"], `eventMediaAssets[${index}].peopleDeclaration`);
  }
  for (const [index, row] of result.eventMediaDerivatives.entries()) {
    if (!assetIds.has(text(row.assetId))) throw new Error(`eventMediaDerivatives[${index}] has an invalid asset link`);
    oneOf(row.status, ["READY","FAILED"], `eventMediaDerivatives[${index}].status`);
    if (row.status === "READY") {
      if (!/^derivative\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.jpg$/.test(text(row.storageKey))) throw new Error(`eventMediaDerivatives[${index}].storageKey is invalid`);
      hash(row.sha256, `eventMediaDerivatives[${index}].sha256`); positive(row.byteSize, `eventMediaDerivatives[${index}].byteSize`); positive(row.width, `eventMediaDerivatives[${index}].width`); positive(row.height, `eventMediaDerivatives[${index}].height`);
      if (row.metadataStripped !== true) throw new Error(`eventMediaDerivatives[${index}] must be metadata-stripped`);
    }
  }
  const associationKeys = new Set<string>();
  for (const [index, row] of result.eventMediaStudentAssociations.entries()) { if (!assetIds.has(text(row.assetId))) throw new Error(`eventMediaStudentAssociations[${index}] has an invalid asset link`); const key = `${row.assetId}|${row.studentId}`; if (associationKeys.has(key)) throw new Error(`eventMediaStudentAssociations[${index}] duplicates an association`); associationKeys.add(key); }
  for (const [index, row] of result.mediaPublicationConsents.entries()) { oneOf(row.audience, ["PARENT_PORTAL","PUBLIC"], `mediaPublicationConsents[${index}].audience`); oneOf(row.status, ["GRANTED","REVOKED"], `mediaPublicationConsents[${index}].status`); oneOf(row.source, ["SIGNED_FORM","GUARDIAN_PORTAL","IN_PERSON_GUARDIAN","OTHER_DOCUMENTED"], `mediaPublicationConsents[${index}].source`); if (row.purposeScope !== "EVENT_MEDIA_PUBLICATION") throw new Error(`mediaPublicationConsents[${index}].purposeScope is invalid`); }
  for (const [index, row] of result.eventMediaAuditEvents.entries()) { if (row.albumId && !albumIds.has(text(row.albumId))) throw new Error(`eventMediaAuditEvents[${index}] has an invalid album link`); if (row.assetId && !assetIds.has(text(row.assetId))) throw new Error(`eventMediaAuditEvents[${index}] has an invalid asset link`); if (row.consentId && !consentIds.has(text(row.consentId))) throw new Error(`eventMediaAuditEvents[${index}] has an invalid consent link`); if (row.safeMetadataJson) json(row.safeMetadataJson, `eventMediaAuditEvents[${index}].safeMetadataJson`); }
  if (/imageBinary|base64|data:image|password|secret|cookie|sessionToken/i.test(JSON.stringify(result))) throw new Error("Event Media backup contains prohibited binary or secret material");
  return result;
}

export function eventMediaBackupCount(value: EventMediaBackup) { return EVENT_MEDIA_BACKUP_KEYS.reduce((sum, key) => sum + value[key].length, 0); }

export async function restoreEventMediaBackup(client: PrismaClient, backup: EventMediaBackup, maps: { students: Map<string,string>; guardians: Map<string,string>; users: Map<string,string>; restoredBy: string }, result: Result) {
  const db = client as any, albumMap = new Map<string,string>(), assetMap = new Map<string,string>(), consentMap = new Map<string,string>();
  const actor = (value: unknown) => maps.users.get(text(value)) ?? maps.restoredBy;
  const optionalActor = (value: unknown) => value ? actor(value) : null;
  for (const [index,row] of backup.eventMediaAlbums.entries()) try { const id=text(row.id), publicKey=text(row.publicKey), existing=await db.eventMediaAlbum.findFirst({where:{OR:[{id},{publicKey}]}}); if(existing){if(existing.id===id&&existing.publicKey===publicKey){albumMap.set(id,id);result.eventMediaAlbums.skipped++;}else throw new Error("album identity collision");continue;} await db.eventMediaAlbum.create({data:{...dates(row,["eventDate","retentionReviewAt","reviewedAt","approvedAt","publishedAt","unpublishedAt","archivedAt","createdAt","updatedAt"]),createdByUserId:actor(row.createdByUserId),reviewedByUserId:optionalActor(row.reviewedByUserId),approvedByUserId:optionalActor(row.approvedByUserId),publishedByUserId:optionalActor(row.publishedByUserId),unpublishedByUserId:optionalActor(row.unpublishedByUserId),archivedByUserId:optionalActor(row.archivedByUserId)}});albumMap.set(id,id);result.eventMediaAlbums.created++; } catch(error){result.eventMediaAlbums.errors.push(errorText("Event Media album",index,error));}
  for (const [index,row] of backup.eventMediaAssets.entries()) try { const id=text(row.id), albumId=albumMap.get(text(row.albumId)); if(!albumId){result.eventMediaAssets.skipped++;continue;} const publicKey=text(row.publicKey),existing=await db.eventMediaAsset.findFirst({where:{OR:[{id},{publicKey}]}});if(existing){if(existing.id===id&&existing.publicKey===publicKey){assetMap.set(id,id);result.eventMediaAssets.skipped++;}else throw new Error("asset identity collision");continue;} await db.eventMediaAsset.create({data:{...dates(row,["uploadedAt","reviewedAt","withdrawnAt","backupVerifiedAt","archivedAt","createdAt","updatedAt"]),albumId,uploadActorUserId:actor(row.uploadActorUserId),reviewedByUserId:optionalActor(row.reviewedByUserId)}});assetMap.set(id,id);result.eventMediaAssets.created++; } catch(error){result.eventMediaAssets.errors.push(errorText("Event Media asset",index,error));}
  for (const [index,row] of backup.eventMediaDerivatives.entries()) try { const assetId=assetMap.get(text(row.assetId));if(!assetId){result.eventMediaDerivatives.skipped++;continue;}const id=text(row.id);if(await db.eventMediaDerivative.findUnique({where:{id}})){result.eventMediaDerivatives.skipped++;continue;}await db.eventMediaDerivative.create({data:{...dates(row,["createdAt"]),assetId}});result.eventMediaDerivatives.created++; } catch(error){result.eventMediaDerivatives.errors.push(errorText("Event Media derivative",index,error));}
  for (const [index,row] of backup.eventMediaStudentAssociations.entries()) try { const assetId=assetMap.get(text(row.assetId)),studentId=maps.students.get(text(row.studentId));if(!assetId||!studentId){result.eventMediaStudentAssociations.skipped++;continue;}const existing=await db.eventMediaStudentAssociation.findUnique({where:{assetId_studentId:{assetId,studentId}}});if(existing){result.eventMediaStudentAssociations.skipped++;continue;}await db.eventMediaStudentAssociation.create({data:{...dates(row,["associatedAt"]),assetId,studentId,associatedByUserId:actor(row.associatedByUserId)}});result.eventMediaStudentAssociations.created++; } catch(error){result.eventMediaStudentAssociations.errors.push(errorText("Event Media association",index,error));}
  for (const [index,row] of backup.mediaPublicationConsents.entries()) try { const id=text(row.id),studentId=maps.students.get(text(row.studentId)),guardianId=row.guardianId?maps.guardians.get(text(row.guardianId)):null;if(!studentId||(row.guardianId&&!guardianId)){result.mediaPublicationConsents.skipped++;continue;}const publicKey=text(row.publicKey),existing=await db.mediaPublicationConsent.findFirst({where:{OR:[{id},{publicKey}]}});if(existing){if(existing.id===id&&existing.publicKey===publicKey){consentMap.set(id,id);result.mediaPublicationConsents.skipped++;}else throw new Error("consent identity collision");continue;}await db.mediaPublicationConsent.create({data:{...dates(row,["grantedAt","expiresAt","revokedAt","createdAt","updatedAt"]),studentId,guardianId:guardianId??null,recordedByUserId:actor(row.recordedByUserId),revokedByUserId:optionalActor(row.revokedByUserId)}});consentMap.set(id,id);result.mediaPublicationConsents.created++; }catch(error){result.mediaPublicationConsents.errors.push(errorText("Media publication consent",index,error));}
  for (const [index,row] of backup.eventMediaAuditEvents.entries()) try { const id=text(row.id);if(await db.eventMediaAuditEvent.findUnique({where:{id}})){result.eventMediaAuditEvents.skipped++;continue;}const albumId=row.albumId?albumMap.get(text(row.albumId)):null,assetId=row.assetId?assetMap.get(text(row.assetId)):null,consentId=row.consentId?consentMap.get(text(row.consentId)):null;if((row.albumId&&!albumId)||(row.assetId&&!assetId)||(row.consentId&&!consentId)){result.eventMediaAuditEvents.skipped++;continue;}await db.eventMediaAuditEvent.create({data:{...dates(row,["eventDate","createdAt"]),albumId:albumId??null,assetId:assetId??null,consentId:consentId??null,actorUserId:actor(row.actorUserId)}});result.eventMediaAuditEvents.created++; }catch(error){result.eventMediaAuditEvents.errors.push(errorText("Event Media audit",index,error));}
}

function rows(value:unknown,label:string,allowed:Set<string>,required:string[]){if(value===undefined)return[];if(!Array.isArray(value)||value.length>100_000)throw new Error(`${label} must be a bounded array`);return value.map((item,index)=>{if(!item||typeof item!=="object"||Array.isArray(item))throw new Error(`${label}[${index}] must be an object`);const row=item as Record<string,unknown>;for(const key of Object.keys(row))if(!allowed.has(key))throw new Error(`${label}[${index}].${key} is unsupported`);for(const key of required)if(row[key]===undefined||row[key]===null||row[key]==="")throw new Error(`${label}[${index}].${key} is required`);return row;});}
function unique(rows:Record<string,unknown>[],label:string,field:string){const values=new Set<string>();rows.forEach((row,index)=>{const value=text(row[field]);if(!value||values.has(value))throw new Error(`${label}[${index}].${field} is missing or duplicated`);values.add(value);});return values;}
function text(value:unknown){return String(value??"").trim();}
function oneOf(value:unknown,allowed:string[],label:string){if(!allowed.includes(text(value)))throw new Error(`${label} is unsupported`);}
function positive(value:unknown,label:string){const number=Number(value);if(!Number.isInteger(number)||number<1)throw new Error(`${label} is invalid`);return number;}
function hash(value:unknown,label:string){if(!/^[a-f0-9]{64}$/i.test(text(value)))throw new Error(`${label} is invalid`);}
function date(value:unknown,label:string){if(Number.isNaN(new Date(String(value)).getTime()))throw new Error(`${label} is invalid`);}
function json(value:unknown,label:string){if(typeof value!=="string"||value.length>2_000_000)throw new Error(`${label} is invalid`);try{return JSON.parse(value);}catch{throw new Error(`${label} is invalid`);}}
function dates(row:Record<string,unknown>,fields:string[]){const value={...row};for(const field of fields)if(value[field])value[field]=new Date(String(value[field]));return value;}
function errorText(label:string,index:number,error:unknown){return `${label} ${index+1}: ${error instanceof Error?error.message:"Unknown restore error"}`;}
