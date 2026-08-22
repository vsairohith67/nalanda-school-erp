import type { PrismaClient } from "@prisma/client";

export const PARENT_MEETING_BACKUP_KEYS = ["parentMeetings", "parentMeetingPreferences", "parentMeetingParticipants", "parentMeetingNotes", "parentMeetingFollowUps", "parentMeetingEvents"] as const;
export type ParentMeetingBackupKey = (typeof PARENT_MEETING_BACKUP_KEYS)[number];
export type ParentMeetingBackup = Record<ParentMeetingBackupKey, Record<string, unknown>[]>;
type EntityResult = { created: number; updated: number; skipped: number; errors: string[] };
type Result = Record<ParentMeetingBackupKey, EntityResult> & { warnings: string[] };

const FIELDS: Record<ParentMeetingBackupKey, Set<string>> = {
  parentMeetings: new Set(["id","publicKey","studentId","requesterGuardianId","academicYear","source","category","subject","requestReason","status","scheduledStartAt","scheduledEndAt","durationMinutes","mode","locationReference","onlineReference","requesterUserId","createdByUserId","scheduledByUserId","completedByUserId","cancelledByUserId","cancellationInternalReason","parentCancellationSummary","noShowState","followUpRequired","completedAt","cancelledAt","activeRequestKey","rowVersion","createdAt","updatedAt"]),
  parentMeetingPreferences: new Set(["id","meetingId","sequence","startsAt","endsAt","createdAt"]),
  parentMeetingParticipants: new Set(["id","publicKey","meetingId","staffMemberId","participantRole","status","assignedByUserId","assignedAt","attendanceAt","removedAt","rowVersion","createdAt","updatedAt"]),
  parentMeetingNotes: new Set(["id","publicKey","meetingId","kind","body","authorUserId","authorRole","correctsNoteId","correctionReason","createdAt"]),
  parentMeetingFollowUps: new Set(["id","publicKey","meetingId","internalDescription","parentVisibleDescription","responsibleStaffMemberId","dueDate","status","createdByUserId","completedByUserId","cancelledByUserId","completedAt","cancelledAt","cancellationReason","rowVersion","createdAt","updatedAt"]),
  parentMeetingEvents: new Set(["id","publicKey","meetingId","eventType","actorUserId","actorRole","previousStatus","newStatus","reason","safeMetadataJson","occurredAt","createdAt"])
};

const REQUIRED: Record<ParentMeetingBackupKey, string[]> = {
  parentMeetings: ["id","publicKey","studentId","academicYear","source","category","subject","status","createdByUserId","rowVersion","createdAt","updatedAt"],
  parentMeetingPreferences: ["id","meetingId","sequence","startsAt","endsAt","createdAt"],
  parentMeetingParticipants: ["id","publicKey","meetingId","staffMemberId","participantRole","status","assignedByUserId","assignedAt","rowVersion","createdAt","updatedAt"],
  parentMeetingNotes: ["id","publicKey","meetingId","kind","body","authorUserId","authorRole","createdAt"],
  parentMeetingFollowUps: ["id","publicKey","meetingId","internalDescription","responsibleStaffMemberId","dueDate","status","createdByUserId","rowVersion","createdAt","updatedAt"],
  parentMeetingEvents: ["id","publicKey","meetingId","eventType","actorUserId","actorRole","occurredAt","createdAt"]
};

export function emptyParentMeetingBackup(): ParentMeetingBackup {
  return Object.fromEntries(PARENT_MEETING_BACKUP_KEYS.map((key) => [key, []])) as unknown as ParentMeetingBackup;
}

export async function parentMeetingSchemaAvailable(client: PrismaClient) {
  try {
    const rows = await client.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type='table' AND name='ParentMeeting'");
    return rows.length === 1;
  } catch { return false; }
}

export async function loadParentMeetingBackup(client: PrismaClient): Promise<ParentMeetingBackup> {
  const db = client as any;
  const [meetings, preferences, participants, notes, followUps, events] = await Promise.all([
    db.parentMeeting.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    db.parentMeetingPreference.findMany({ orderBy: [{ meetingId: "asc" }, { sequence: "asc" }] }),
    db.parentMeetingParticipant.findMany({ orderBy: [{ meetingId: "asc" }, { assignedAt: "asc" }] }),
    db.parentMeetingNote.findMany({ orderBy: [{ meetingId: "asc" }, { createdAt: "asc" }, { id: "asc" }] }),
    db.parentMeetingFollowUp.findMany({ orderBy: [{ meetingId: "asc" }, { dueDate: "asc" }] }),
    db.parentMeetingEvent.findMany({ orderBy: [{ meetingId: "asc" }, { occurredAt: "asc" }, { id: "asc" }] })
  ]);
  return { parentMeetings: meetings, parentMeetingPreferences: preferences, parentMeetingParticipants: participants, parentMeetingNotes: notes, parentMeetingFollowUps: followUps, parentMeetingEvents: events };
}

export function validateParentMeetingBackupRows(root: Record<string, unknown>): ParentMeetingBackup {
  const result = Object.fromEntries(PARENT_MEETING_BACKUP_KEYS.map((key) => [key, rows(root[key], key, FIELDS[key], REQUIRED[key])])) as ParentMeetingBackup;
  const meetingIds = unique(result.parentMeetings, "parentMeetings", "id"); unique(result.parentMeetings, "parentMeetings", "publicKey");
  const noteIds = unique(result.parentMeetingNotes, "parentMeetingNotes", "id"); unique(result.parentMeetingNotes, "parentMeetingNotes", "publicKey");
  for (const key of ["parentMeetingParticipants", "parentMeetingFollowUps", "parentMeetingEvents"] as const) { unique(result[key], key, "id"); unique(result[key], key, "publicKey"); }
  unique(result.parentMeetingPreferences, "parentMeetingPreferences", "id");
  for (const [index, row] of result.parentMeetings.entries()) {
    oneOf(row.source, ["PARENT_REQUEST","LEADERSHIP_CREATED"], `parentMeetings[${index}].source`);
    oneOf(row.category, ["ACADEMIC_PROGRESS","ATTENDANCE","GENERAL_SCHOOL_DISCUSSION","ADMINISTRATIVE","PRINCIPAL_APPOINTMENT","OTHER"], `parentMeetings[${index}].category`);
    oneOf(row.status, ["REQUESTED","SCHEDULING","SCHEDULED","CONFIRMED","COMPLETED","CANCELLED","NO_SHOW"], `parentMeetings[${index}].status`);
    positive(row.rowVersion, `parentMeetings[${index}].rowVersion`);
    if (row.durationMinutes !== null && row.durationMinutes !== undefined && (Number(row.durationMinutes) < 10 || Number(row.durationMinutes) > 180)) throw new Error(`parentMeetings[${index}].durationMinutes is invalid`);
  }
  for (const key of PARENT_MEETING_BACKUP_KEYS.filter((item) => item !== "parentMeetings") as ParentMeetingBackupKey[]) for (const [index, row] of result[key].entries()) if (!meetingIds.has(text(row.meetingId))) throw new Error(`${key}[${index}] has an invalid meeting link`);
  for (const [index, row] of result.parentMeetingNotes.entries()) { oneOf(row.kind, ["LEADERSHIP_PRIVATE","PARTICIPANT_INTERNAL","PARENT_VISIBLE_SUMMARY"], `parentMeetingNotes[${index}].kind`); if (row.correctsNoteId && !noteIds.has(text(row.correctsNoteId))) throw new Error(`parentMeetingNotes[${index}] has an invalid correction link`); }
  for (const [index, row] of result.parentMeetingFollowUps.entries()) oneOf(row.status, ["OPEN","DONE","CANCELLED"], `parentMeetingFollowUps[${index}].status`);
  for (const [index, row] of result.parentMeetingEvents.entries()) if (row.safeMetadataJson) json(row.safeMetadataJson, `parentMeetingEvents[${index}].safeMetadataJson`);
  if (/password|sessionToken|cookie|secret|credential/i.test(JSON.stringify(result))) throw new Error("Parent Meeting backup contains prohibited authentication or secret material");
  return result;
}

export async function restoreParentMeetingBackup(client: PrismaClient, backup: ParentMeetingBackup, maps: { students: Map<string,string>; guardians: Map<string,string>; staffMembers: Map<string,string>; users: Map<string,string>; restoredBy: string }, result: Result) {
  const db = client as any, meetingMap = new Map<string,string>(), noteMap = new Map<string,string>();
  const actor = (value: unknown) => maps.users.get(text(value)) ?? maps.restoredBy;
  const optionalActor = (value: unknown) => value ? actor(value) : null;
  for (const [index,row] of backup.parentMeetings.entries()) try { const id=text(row.id),publicKey=text(row.publicKey),studentId=maps.students.get(text(row.studentId)),guardianId=row.requesterGuardianId?maps.guardians.get(text(row.requesterGuardianId)):null;if(!studentId||(row.requesterGuardianId&&!guardianId)){result.parentMeetings.skipped++;continue;}const existing=await db.parentMeeting.findFirst({where:{OR:[{id},{publicKey}]}});if(existing){if(existing.id===id&&existing.publicKey===publicKey){meetingMap.set(id,id);result.parentMeetings.skipped++;}else throw new Error("meeting identity collision");continue;}await db.parentMeeting.create({data:{...dates(row,["scheduledStartAt","scheduledEndAt","completedAt","cancelledAt","createdAt","updatedAt"]),studentId,requesterGuardianId:guardianId??null,requesterUserId:optionalActor(row.requesterUserId),createdByUserId:actor(row.createdByUserId),scheduledByUserId:optionalActor(row.scheduledByUserId),completedByUserId:optionalActor(row.completedByUserId),cancelledByUserId:optionalActor(row.cancelledByUserId)}});meetingMap.set(id,id);result.parentMeetings.created++;}catch(error){result.parentMeetings.errors.push(errorText("Parent meeting",index,error));}
  for (const [index,row] of backup.parentMeetingPreferences.entries()) try { const meetingId=meetingMap.get(text(row.meetingId));if(!meetingId){result.parentMeetingPreferences.skipped++;continue;}const id=text(row.id);if(await db.parentMeetingPreference.findUnique({where:{id}})){result.parentMeetingPreferences.skipped++;continue;}await db.parentMeetingPreference.create({data:{...dates(row,["startsAt","endsAt","createdAt"]),meetingId}});result.parentMeetingPreferences.created++;}catch(error){result.parentMeetingPreferences.errors.push(errorText("Parent meeting preference",index,error));}
  for (const [index,row] of backup.parentMeetingParticipants.entries()) try { const meetingId=meetingMap.get(text(row.meetingId)),staffMemberId=maps.staffMembers.get(text(row.staffMemberId));if(!meetingId||!staffMemberId){result.parentMeetingParticipants.skipped++;continue;}const id=text(row.id),publicKey=text(row.publicKey),existing=await db.parentMeetingParticipant.findFirst({where:{OR:[{id},{publicKey}]}});if(existing){if(existing.id===id&&existing.publicKey===publicKey)result.parentMeetingParticipants.skipped++;else throw new Error("participant identity collision");continue;}await db.parentMeetingParticipant.create({data:{...dates(row,["assignedAt","attendanceAt","removedAt","createdAt","updatedAt"]),meetingId,staffMemberId,assignedByUserId:actor(row.assignedByUserId)}});result.parentMeetingParticipants.created++;}catch(error){result.parentMeetingParticipants.errors.push(errorText("Parent meeting participant",index,error));}
  for (const [index,row] of backup.parentMeetingNotes.entries()) try { const meetingId=meetingMap.get(text(row.meetingId));if(!meetingId){result.parentMeetingNotes.skipped++;continue;}const id=text(row.id),publicKey=text(row.publicKey),existing=await db.parentMeetingNote.findFirst({where:{OR:[{id},{publicKey}]}});if(existing){if(existing.id===id&&existing.publicKey===publicKey){noteMap.set(id,id);result.parentMeetingNotes.skipped++;}else throw new Error("note identity collision");continue;}const correctsNoteId=row.correctsNoteId?noteMap.get(text(row.correctsNoteId)):null;if(row.correctsNoteId&&!correctsNoteId)throw new Error("correction target was not restored");await db.parentMeetingNote.create({data:{...dates(row,["createdAt"]),meetingId,authorUserId:actor(row.authorUserId),correctsNoteId:correctsNoteId??null}});noteMap.set(id,id);result.parentMeetingNotes.created++;}catch(error){result.parentMeetingNotes.errors.push(errorText("Parent meeting note",index,error));}
  for (const [index,row] of backup.parentMeetingFollowUps.entries()) try { const meetingId=meetingMap.get(text(row.meetingId)),responsibleStaffMemberId=maps.staffMembers.get(text(row.responsibleStaffMemberId));if(!meetingId||!responsibleStaffMemberId){result.parentMeetingFollowUps.skipped++;continue;}const id=text(row.id),publicKey=text(row.publicKey),existing=await db.parentMeetingFollowUp.findFirst({where:{OR:[{id},{publicKey}]}});if(existing){if(existing.id===id&&existing.publicKey===publicKey)result.parentMeetingFollowUps.skipped++;else throw new Error("follow-up identity collision");continue;}await db.parentMeetingFollowUp.create({data:{...dates(row,["dueDate","completedAt","cancelledAt","createdAt","updatedAt"]),meetingId,responsibleStaffMemberId,createdByUserId:actor(row.createdByUserId),completedByUserId:optionalActor(row.completedByUserId),cancelledByUserId:optionalActor(row.cancelledByUserId)}});result.parentMeetingFollowUps.created++;}catch(error){result.parentMeetingFollowUps.errors.push(errorText("Parent meeting follow-up",index,error));}
  for (const [index,row] of backup.parentMeetingEvents.entries()) try { const meetingId=meetingMap.get(text(row.meetingId));if(!meetingId){result.parentMeetingEvents.skipped++;continue;}const id=text(row.id),publicKey=text(row.publicKey),existing=await db.parentMeetingEvent.findFirst({where:{OR:[{id},{publicKey}]}});if(existing){if(existing.id===id&&existing.publicKey===publicKey)result.parentMeetingEvents.skipped++;else throw new Error("event identity collision");continue;}await db.parentMeetingEvent.create({data:{...dates(row,["occurredAt","createdAt"]),meetingId,actorUserId:actor(row.actorUserId)}});result.parentMeetingEvents.created++;}catch(error){result.parentMeetingEvents.errors.push(errorText("Parent meeting event",index,error));}
}

function rows(value:unknown,label:string,allowed:Set<string>,required:string[]){if(value===undefined)return[];if(!Array.isArray(value)||value.length>100_000)throw new Error(`${label} must be a bounded array`);return value.map((item,index)=>{if(!item||typeof item!=="object"||Array.isArray(item))throw new Error(`${label}[${index}] must be an object`);const row=item as Record<string,unknown>;for(const key of Object.keys(row))if(!allowed.has(key))throw new Error(`${label}[${index}].${key} is unsupported`);for(const key of required)if(row[key]===undefined||row[key]===null||row[key]==="")throw new Error(`${label}[${index}].${key} is required`);return row;});}
function unique(items:Record<string,unknown>[],label:string,field:string){const values=new Set<string>();items.forEach((row,index)=>{const value=text(row[field]);if(!value||values.has(value))throw new Error(`${label}[${index}].${field} is missing or duplicated`);values.add(value);});return values;}
function text(value:unknown){return String(value??"").trim();}
function oneOf(value:unknown,allowed:string[],label:string){if(!allowed.includes(text(value)))throw new Error(`${label} is unsupported`);}
function positive(value:unknown,label:string){const number=Number(value);if(!Number.isInteger(number)||number<1)throw new Error(`${label} is invalid`);return number;}
function json(value:unknown,label:string){if(typeof value!=="string"||value.length>2_000_000)throw new Error(`${label} is invalid`);try{return JSON.parse(value);}catch{throw new Error(`${label} is invalid`);}}
function dates(row:Record<string,unknown>,fields:string[]){const value={...row};for(const field of fields)if(value[field])value[field]=new Date(String(value[field]));return value;}
function errorText(label:string,index:number,error:unknown){return `${label} ${index+1}: ${error instanceof Error?error.message:"Unknown restore error"}`;}
