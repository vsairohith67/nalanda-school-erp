import type { Prisma, PrismaClient } from "@prisma/client";
import type { Role } from "@/lib/permissions";
import {
  createEventMediaThumbnail,
  EventMediaFileError,
  rollbackEventMediaBytes,
  storeEventMediaBytes,
  validateEventMediaUpload
} from "@/lib/event-media-files";

export const EVENT_MEDIA_VISIBILITIES = ["PRIVATE_LEADERSHIP", "INTERNAL_AUTHORISED", "PARENT_PORTAL", "PUBLIC"] as const;
export const EVENT_MEDIA_ALBUM_STATUSES = ["DRAFT", "PRIVATE", "UNDER_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"] as const;
export const EVENT_MEDIA_PEOPLE_DECLARATIONS = ["UNKNOWN", "NO_STUDENTS", "MANUAL_ASSOCIATIONS_COMPLETE"] as const;
export const EVENT_MEDIA_CONSENT_SOURCES = ["SIGNED_FORM", "GUARDIAN_PORTAL", "IN_PERSON_GUARDIAN", "OTHER_DOCUMENTED"] as const;

type Client = PrismaClient | Prisma.TransactionClient;
export type EventMediaActor = { id: string; role: Role };
type Visibility = (typeof EVENT_MEDIA_VISIBILITIES)[number];

export class EventMediaError extends Error {
  constructor(message: string, public status = 400, public code = "EVENT_MEDIA_INVALID") { super(message); }
}

export function eventMediaPublicGalleryEnabled() {
  return process.env.EVENT_MEDIA_PUBLIC_GALLERY_ENABLED?.trim().toLowerCase() === "true";
}

export async function createEventMediaAlbum(client: PrismaClient, input: unknown, actor: EventMediaActor) {
  requireLeadership(actor);
  const row = object(input);
  const title = boundedText(row.title, 3, 180, "Album title");
  const description = optionalText(row.description, 4_000, "Description");
  const eventDate = requiredDate(row.eventDate, "Event date");
  const visibility = oneOf(row.visibility ?? "PRIVATE_LEADERSHIP", EVENT_MEDIA_VISIBILITIES, "Visibility");
  const retentionReviewAt = row.retentionReviewAt ? requiredDate(row.retentionReviewAt, "Retention review date") : null;
  return client.$transaction(async (tx) => {
    const album = await tx.eventMediaAlbum.create({ data: { title, description, eventDate, visibility, retentionReviewAt, createdByUserId: actor.id } });
    await audit(tx, actor, { albumId: album.id, eventType: "ALBUM_CREATED", newState: "DRAFT", safe: { visibility, retentionPolicy: album.retentionPolicy } });
    return album;
  });
}

export async function updateEventMediaAlbum(client: PrismaClient, albumKey: string, input: unknown, actor: EventMediaActor) {
  requireLeadership(actor);
  const row = object(input);
  return client.$transaction(async (tx) => {
    const album = await albumByKey(tx, albumKey);
    if (!["DRAFT", "PRIVATE"].includes(album.status)) throw new EventMediaError("Only a draft or private album can be edited.", 409, "ALBUM_LOCKED");
    const data = {
      ...(row.title !== undefined ? { title: boundedText(row.title, 3, 180, "Album title") } : {}),
      ...(row.description !== undefined ? { description: optionalText(row.description, 4_000, "Description") } : {}),
      ...(row.eventDate !== undefined ? { eventDate: requiredDate(row.eventDate, "Event date") } : {}),
      ...(row.visibility !== undefined ? { visibility: oneOf(row.visibility, EVENT_MEDIA_VISIBILITIES, "Visibility") } : {}),
      ...(row.retentionReviewAt !== undefined ? { retentionReviewAt: row.retentionReviewAt ? requiredDate(row.retentionReviewAt, "Retention review date") : null } : {}),
      rowVersion: { increment: 1 }
    };
    const updated = await tx.eventMediaAlbum.update({ where: { id: album.id }, data });
    await audit(tx, actor, { albumId: album.id, eventType: "ALBUM_UPDATED", previousState: album.status, newState: updated.status, safe: { visibility: updated.visibility } });
    return updated;
  });
}

export async function uploadEventMediaAsset(client: PrismaClient, albumKey: string, file: File, actor: EventMediaActor) {
  const original = await validateEventMediaUpload(file);
  const album = await albumByKey(client, albumKey);
  if (!["DRAFT", "PRIVATE"].includes(album.status)) throw new EventMediaError("Uploads are allowed only while the album is private.", 409, "ALBUM_UPLOAD_LOCKED");
  const originalStorageKey = await storeEventMediaBytes("original", original.extension, original.bytes);
  let asset: any;
  try {
    asset = await client.$transaction(async (tx) => {
      const current = await albumByKey(tx, albumKey);
      if (!["DRAFT", "PRIVATE"].includes(current.status)) throw new EventMediaError("The album changed before upload completed.", 409, "ALBUM_UPLOAD_CONFLICT");
      const created = await tx.eventMediaAsset.create({ data: {
        albumId: current.id, originalStorageKey, originalMediaType: original.mediaType, originalExtension: original.extension,
        originalByteSize: original.byteSize, originalSha256: original.sha256, originalWidth: original.width, originalHeight: original.height,
        uploadActorUserId: actor.id
      } });
      await tx.eventMediaAlbum.update({ where: { id: current.id }, data: { status: "PRIVATE", reviewStatus: "NOT_SUBMITTED", publicationState: "PRIVATE", coverAssetPublicKey: current.coverAssetPublicKey ?? created.publicKey, rowVersion: { increment: 1 } } });
      await audit(tx, actor, { albumId: current.id, assetId: created.id, eventType: "MEDIA_UPLOADED", newState: "PRIVATE", safe: { mediaType: original.mediaType, byteSize: original.byteSize, width: original.width, height: original.height, sha256: original.sha256 } });
      return created;
    });
  } catch (error) {
    await rollbackEventMediaBytes(originalStorageKey).catch(() => undefined);
    throw error;
  }

  let derivativeStorageKey: string | null = null;
  try {
    const thumbnail = await createEventMediaThumbnail(original);
    derivativeStorageKey = await storeEventMediaBytes("derivative", thumbnail.extension, thumbnail.bytes);
    await client.$transaction(async (tx) => {
      await tx.eventMediaDerivative.create({ data: {
        assetId: asset.id, kind: "THUMBNAIL", status: "READY", storageKey: derivativeStorageKey,
        mediaType: thumbnail.mediaType, extension: thumbnail.extension, byteSize: thumbnail.byteSize,
        sha256: thumbnail.sha256, width: thumbnail.width, height: thumbnail.height, metadataStripped: true
      } });
      await tx.eventMediaAsset.update({ where: { id: asset.id }, data: { derivativeStatus: "READY", rowVersion: { increment: 1 } } });
      await audit(tx, actor, { albumId: album.id, assetId: asset.id, eventType: "DERIVATIVE_GENERATED", newState: "READY", safe: { kind: "THUMBNAIL", width: thumbnail.width, height: thumbnail.height, metadataStripped: true, sha256: thumbnail.sha256 } });
    });
  } catch (error) {
    if (derivativeStorageKey) await rollbackEventMediaBytes(derivativeStorageKey).catch(() => undefined);
    const code = error instanceof EventMediaFileError ? error.code : "DERIVATIVE_GENERATION_FAILED";
    await client.$transaction(async (tx) => {
      await tx.eventMediaDerivative.upsert({ where: { assetId_kind: { assetId: asset.id, kind: "THUMBNAIL" } }, create: { assetId: asset.id, kind: "THUMBNAIL", status: "FAILED", failureCode: code }, update: { status: "FAILED", failureCode: code, storageKey: null, mediaType: null, extension: null, byteSize: null, sha256: null, width: null, height: null } });
      await tx.eventMediaAsset.update({ where: { id: asset.id }, data: { derivativeStatus: "FAILED", rowVersion: { increment: 1 } } });
      await audit(tx, actor, { albumId: album.id, assetId: asset.id, eventType: "DERIVATIVE_GENERATION_FAILED", previousState: "PENDING", newState: "FAILED", safe: { code } });
    });
  }
  return getEventMediaAsset(client, asset.publicKey);
}

export async function updateEventMediaAsset(client: PrismaClient, assetKey: string, input: unknown, actor: EventMediaActor) {
  const row = object(input);
  return client.$transaction(async (tx) => {
    const asset = await assetByKey(tx, assetKey, { album: true });
    if (!["DRAFT", "PRIVATE", "UNDER_REVIEW"].includes(asset.album.status)) throw new EventMediaError("The album is locked for media review changes.", 409, "MEDIA_REVIEW_LOCKED");
    const caption = row.caption !== undefined ? optionalText(row.caption, 2_000, "Caption") : asset.caption;
    const peopleDeclaration = row.peopleDeclaration !== undefined ? oneOf(row.peopleDeclaration, EVENT_MEDIA_PEOPLE_DECLARATIONS, "People declaration") : asset.peopleDeclaration;
    const reviewStatus = row.reviewStatus !== undefined ? oneOf(row.reviewStatus, ["PENDING", "APPROVED", "REJECTED"] as const, "Review status") : asset.reviewStatus;
    const reviewNote = row.reviewNote !== undefined ? optionalText(row.reviewNote, 2_000, "Review note") : asset.reviewNote;
    let studentIds: string[] | null = null;
    let associationCount: number;
    if (row.studentAdmissionNos !== undefined) {
      if (!Array.isArray(row.studentAdmissionNos) || row.studentAdmissionNos.length > 50) throw new EventMediaError("Manual Student associations must be a bounded list.");
      const admissionNos = [...new Set(row.studentAdmissionNos.map((value) => boundedText(value, 1, 80, "Admission number")))];
      const students = await tx.student.findMany({ where: { admissionNo: { in: admissionNos }, deletedAt: null }, select: { id: true, admissionNo: true } });
      if (students.length !== admissionNos.length) throw new EventMediaError("One or more Student associations are unavailable.", 404, "STUDENT_NOT_FOUND");
      studentIds = students.map((student) => student.id);
      associationCount = studentIds.length;
      if (peopleDeclaration === "NO_STUDENTS" && associationCount) throw new EventMediaError("A no-Students declaration cannot retain manual Student associations.", 409, "PEOPLE_ASSOCIATION_CONFLICT");
      if (peopleDeclaration === "MANUAL_ASSOCIATIONS_COMPLETE" && !studentIds.length) throw new EventMediaError("Complete manual associations require at least one Student.");
      await tx.eventMediaStudentAssociation.deleteMany({ where: { assetId: asset.id } });
      if (studentIds.length) await tx.eventMediaStudentAssociation.createMany({ data: studentIds.map((studentId) => ({ assetId: asset.id, studentId, associatedByUserId: actor.id })) });
    } else {
      associationCount = await tx.eventMediaStudentAssociation.count({ where: { assetId: asset.id } });
      if (peopleDeclaration === "NO_STUDENTS" && associationCount) throw new EventMediaError("A no-Students declaration cannot retain manual Student associations.", 409, "PEOPLE_ASSOCIATION_CONFLICT");
      if (peopleDeclaration === "MANUAL_ASSOCIATIONS_COMPLETE" && !associationCount) throw new EventMediaError("Complete manual associations require at least one Student.");
    }
    const eligibility = await calculateEligibility(tx, asset.id, asset.album.visibility as Visibility, peopleDeclaration);
    const updated = await tx.eventMediaAsset.update({ where: { id: asset.id }, data: {
      caption, peopleDeclaration, reviewStatus, reviewNote,
      reviewedByUserId: reviewStatus === "PENDING" ? null : actor.id,
      reviewedAt: reviewStatus === "PENDING" ? null : new Date(),
      publicationEligibility: eligibility, rowVersion: { increment: 1 }
    } });
    await audit(tx, actor, { albumId: asset.albumId, assetId: asset.id, eventType: "MEDIA_REVIEW_UPDATED", previousState: asset.reviewStatus, newState: reviewStatus, safe: { peopleDeclaration, associationCount, associatedStudentIds: studentIds, publicationEligibility: eligibility, captionPresent: Boolean(caption) } });
    return updated;
  });
}

export async function transitionEventMediaAlbum(client: PrismaClient, albumKey: string, action: unknown, actor: EventMediaActor) {
  const requested = oneOf(action, ["SUBMIT_REVIEW", "APPROVE", "PUBLISH", "UNPUBLISH", "ARCHIVE"] as const, "Album action");
  if (["APPROVE", "PUBLISH", "UNPUBLISH", "ARCHIVE"].includes(requested)) requireLeadership(actor);
  return client.$transaction(async (tx) => {
    const album = await albumByKey(tx, albumKey);
    const assets = await tx.eventMediaAsset.findMany({ where: { albumId: album.id, archivedAt: null }, include: { studentAssociations: true, derivatives: true }, orderBy: { createdAt: "asc" } });
    if (!assets.length && requested !== "ARCHIVE") throw new EventMediaError("Add at least one private photo before continuing.", 409, "ALBUM_EMPTY");
    if (requested === "SUBMIT_REVIEW") {
      if (!["DRAFT", "PRIVATE"].includes(album.status)) throw invalidTransition(album.status, requested);
      await tx.eventMediaAlbum.update({ where: { id: album.id }, data: { status: "UNDER_REVIEW", reviewStatus: "IN_PROGRESS", reviewedByUserId: actor.id, reviewedAt: new Date(), rowVersion: { increment: 1 } } });
      await audit(tx, actor, { albumId: album.id, eventType: "ALBUM_REVIEW_STARTED", previousState: album.status, newState: "UNDER_REVIEW" });
    } else if (requested === "APPROVE") {
      if (album.status !== "UNDER_REVIEW") throw invalidTransition(album.status, requested);
      await assertAlbumReady(tx, album, assets);
      await tx.eventMediaAlbum.update({ where: { id: album.id }, data: { status: "APPROVED", reviewStatus: "APPROVED", publicationState: "APPROVED", approvedByUserId: actor.id, approvedAt: new Date(), rowVersion: { increment: 1 } } });
      await audit(tx, actor, { albumId: album.id, eventType: "ALBUM_APPROVED", previousState: album.status, newState: "APPROVED", safe: { assetCount: assets.length, visibility: album.visibility } });
    } else if (requested === "PUBLISH") {
      if (album.status !== "APPROVED") throw invalidTransition(album.status, requested);
      if (album.visibility === "PRIVATE_LEADERSHIP") throw new EventMediaError("A private-leadership album cannot be published.", 409, "PRIVATE_ALBUM_NOT_PUBLISHABLE");
      if (album.visibility === "PUBLIC" && !eventMediaPublicGalleryEnabled()) throw new EventMediaError("Public Event Media publishing is disabled by the global feature flag.", 409, "PUBLIC_GALLERY_DEFAULT_OFF");
      await assertAlbumReady(tx, album, assets);
      await tx.eventMediaAlbum.update({ where: { id: album.id }, data: { status: "PUBLISHED", publicationState: "PUBLISHED", publishedByUserId: actor.id, publishedAt: new Date(), unpublishedByUserId: null, unpublishedAt: null, rowVersion: { increment: 1 } } });
      await tx.eventMediaAsset.updateMany({ where: { albumId: album.id, archivedAt: null }, data: { publicationStatus: "PUBLISHED", withdrawalState: "NONE", withdrawalReason: null, withdrawnAt: null, rowVersion: { increment: 1 } } });
      await audit(tx, actor, { albumId: album.id, eventType: "ALBUM_PUBLISHED", previousState: "APPROVED", newState: "PUBLISHED", safe: { assetCount: assets.length, visibility: album.visibility, publicFeatureFlag: eventMediaPublicGalleryEnabled() } });
    } else if (requested === "UNPUBLISH") {
      if (album.status !== "PUBLISHED") throw invalidTransition(album.status, requested);
      const now = new Date();
      await tx.eventMediaAlbum.update({ where: { id: album.id }, data: { status: "APPROVED", publicationState: "UNPUBLISHED", unpublishedByUserId: actor.id, unpublishedAt: now, rowVersion: { increment: 1 } } });
      await tx.eventMediaAsset.updateMany({ where: { albumId: album.id, publicationStatus: "PUBLISHED" }, data: { publicationStatus: "WITHDRAWN", withdrawalState: "UNPUBLISHED", withdrawalReason: "ALBUM_UNPUBLISHED", withdrawnAt: now, rowVersion: { increment: 1 } } });
      await audit(tx, actor, { albumId: album.id, eventType: "ALBUM_UNPUBLISHED", previousState: "PUBLISHED", newState: "APPROVED", safe: { assetCount: assets.length } });
    } else {
      if (album.status === "PUBLISHED") throw new EventMediaError("Unpublish the album before archiving it.", 409, "UNPUBLISH_REQUIRED");
      if (album.status === "ARCHIVED") throw invalidTransition(album.status, requested);
      const now = new Date();
      await tx.eventMediaAlbum.update({ where: { id: album.id }, data: { status: "ARCHIVED", publicationState: "ARCHIVED", archivedByUserId: actor.id, archivedAt: now, rowVersion: { increment: 1 } } });
      await tx.eventMediaAsset.updateMany({ where: { albumId: album.id }, data: { archivedAt: now, publicationStatus: "WITHDRAWN", withdrawalState: "ARCHIVED", withdrawalReason: "ALBUM_ARCHIVED", withdrawnAt: now, rowVersion: { increment: 1 } } });
      await audit(tx, actor, { albumId: album.id, eventType: "ALBUM_ARCHIVED", previousState: album.status, newState: "ARCHIVED", safe: { retainedOriginals: true } });
    }
    return albumByKey(tx, albumKey);
  });
}

export async function recordMediaPublicationConsent(client: PrismaClient, input: unknown, actor: EventMediaActor) {
  requireLeadership(actor);
  const row = object(input);
  const audience = oneOf(row.audience, ["PARENT_PORTAL", "PUBLIC"] as const, "Consent audience");
  const source = oneOf(row.source, EVENT_MEDIA_CONSENT_SOURCES, "Consent source");
  const admissionNo = boundedText(row.studentAdmissionNo, 1, 80, "Student admission number");
  const wordingVersion = boundedText(row.wordingVersion, 3, 100, "Consent wording version");
  const evidenceReference = boundedText(row.evidenceReference, 3, 240, "Consent evidence reference");
  const grantedAt = requiredDate(row.grantedAt, "Consent date");
  const expiresAt = row.expiresAt ? requiredDate(row.expiresAt, "Consent expiry") : null;
  if (expiresAt && expiresAt <= grantedAt) throw new EventMediaError("Consent expiry must be after the granted date.");
  return client.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { admissionNo }, select: { id: true } });
    if (!student) throw new EventMediaError("The Student is unavailable.", 404, "STUDENT_NOT_FOUND");
    let guardianId: string | null = null;
    if (row.guardianId) {
      const guardian = await tx.guardian.findUnique({ where: { id: boundedText(row.guardianId, 1, 100, "Guardian") }, select: { id: true, students: { where: { studentId: student.id }, select: { id: true } } } });
      if (!guardian?.students.length) throw new EventMediaError("The consent Guardian is not linked to this Student.", 409, "GUARDIAN_LINK_REQUIRED");
      guardianId = guardian.id;
    }
    const consent = await tx.mediaPublicationConsent.create({ data: { studentId: student.id, guardianId, audience, source, wordingVersion, evidenceReference, grantedAt, expiresAt, recordedByUserId: actor.id } });
    await audit(tx, actor, { consentId: consent.id, eventType: "CONSENT_GRANTED", newState: "GRANTED", safe: { audience, source, wordingVersion, studentReference: admissionNo, expiresAt: expiresAt?.toISOString() ?? null } });
    await refreshStudentAssetEligibility(tx, student.id, audience);
    return consent;
  });
}

export async function revokeMediaPublicationConsent(client: PrismaClient, consentKey: string, reason: unknown, actor: EventMediaActor) {
  requireLeadership(actor);
  const revocationReason = boundedText(reason, 3, 1_000, "Revocation reason");
  return client.$transaction(async (tx) => {
    const consent = await tx.mediaPublicationConsent.findUnique({ where: { publicKey: key(consentKey) } });
    if (!consent) throw new EventMediaError("The media-publication consent record was not found.", 404, "CONSENT_NOT_FOUND");
    if (consent.status === "REVOKED") throw new EventMediaError("This media-publication consent is already revoked.", 409, "CONSENT_ALREADY_REVOKED");
    const now = new Date();
    const updated = await tx.mediaPublicationConsent.update({ where: { id: consent.id }, data: { status: "REVOKED", revokedAt: now, revokedByUserId: actor.id, revocationReason } });
    const affected = await tx.eventMediaAsset.findMany({ where: { publicationStatus: "PUBLISHED", studentAssociations: { some: { studentId: consent.studentId } }, album: { visibility: consent.audience } }, select: { id: true, albumId: true } });
    if (affected.length) await tx.eventMediaAsset.updateMany({ where: { id: { in: affected.map((asset) => asset.id) } }, data: { publicationStatus: "WITHDRAWN", publicationEligibility: "BLOCKED_CONSENT", withdrawalState: "CONSENT_REVOKED", withdrawalReason: revocationReason, withdrawnAt: now, rowVersion: { increment: 1 } } });
    await audit(tx, actor, { consentId: consent.id, eventType: "CONSENT_REVOKED", previousState: "GRANTED", newState: "REVOKED", reason: revocationReason, safe: { audience: consent.audience, affectedPublishedAssets: affected.length } });
    for (const asset of affected) await audit(tx, actor, { albumId: asset.albumId, assetId: asset.id, consentId: consent.id, eventType: "MEDIA_WITHDRAWN_FOR_CONSENT", previousState: "PUBLISHED", newState: "WITHDRAWN", reason: revocationReason });
    await refreshStudentAssetEligibility(tx, consent.studentId, consent.audience as Visibility);
    return updated;
  });
}

export async function listEventMediaDashboard(client: PrismaClient) {
  const albums = await client.eventMediaAlbum.findMany({ include: {
    assets: { where: { archivedAt: null }, include: { derivatives: { where: { kind: "THUMBNAIL" } }, studentAssociations: { include: { student: { select: { admissionNo: true, studentName: true, className: true, section: true } } } } }, orderBy: { createdAt: "asc" } },
    auditEvents: { orderBy: { eventDate: "desc" }, take: 12 }
  }, orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }], take: 100 });
  const studentIds = [...new Set(albums.flatMap((album) => album.assets.flatMap((asset) => asset.studentAssociations.map((association) => association.studentId))))];
  const consents = studentIds.length ? await client.mediaPublicationConsent.findMany({ where: { studentId: { in: studentIds } }, orderBy: [{ grantedAt: "desc" }, { createdAt: "desc" }] }) : [];
  return { publicGalleryEnabled: eventMediaPublicGalleryEnabled(), albums, consents };
}

export async function getEventMediaAsset(client: PrismaClient, assetKey: string) {
  return assetByKey(client, assetKey, { album: true, derivatives: true, studentAssociations: { include: { student: { select: { admissionNo: true, studentName: true, className: true, section: true } } } }, auditEvents: { orderBy: { eventDate: "desc" }, take: 50 } });
}

export async function getPublicEventMediaAlbums(client: PrismaClient) {
  if (!eventMediaPublicGalleryEnabled()) return [];
  const albums = await client.eventMediaAlbum.findMany({ where: { visibility: "PUBLIC", status: "PUBLISHED", publicationState: "PUBLISHED", archivedAt: null }, include: { assets: { where: { publicationStatus: "PUBLISHED", withdrawalState: "NONE", archivedAt: null }, include: { derivatives: { where: { kind: "THUMBNAIL", status: "READY" } }, studentAssociations: true } } }, orderBy: { eventDate: "desc" }, take: 50 });
  const result = [];
  for (const album of albums) {
    const assets = [];
    for (const asset of album.assets) if (await assetHasCurrentConsent(client, asset.id, "PUBLIC", asset.peopleDeclaration)) assets.push(publicAsset(asset));
    if (assets.length) result.push({ publicKey: album.publicKey, title: album.title, eventDate: album.eventDate, description: album.description, assets });
  }
  return result;
}

export async function getParentEventMedia(client: PrismaClient, guardianId: string) {
  const links = await client.studentGuardian.findMany({ where: { guardianId }, select: { studentId: true } });
  const linked = new Set(links.map((link) => link.studentId));
  if (!linked.size) return [];
  const albums = await client.eventMediaAlbum.findMany({ where: { visibility: "PARENT_PORTAL", status: "PUBLISHED", publicationState: "PUBLISHED", archivedAt: null }, include: { assets: { where: { publicationStatus: "PUBLISHED", withdrawalState: "NONE", archivedAt: null, studentAssociations: { some: { studentId: { in: [...linked] } } } }, include: { derivatives: { where: { kind: "THUMBNAIL", status: "READY" } }, studentAssociations: true } } }, orderBy: { eventDate: "desc" }, take: 50 });
  const result = [];
  for (const album of albums) {
    const assets = [];
    for (const asset of album.assets) {
      if (!asset.studentAssociations.length || asset.studentAssociations.some((association) => !linked.has(association.studentId))) continue;
      if (await assetHasCurrentConsent(client, asset.id, "PARENT_PORTAL", asset.peopleDeclaration)) assets.push(publicAsset(asset));
    }
    if (assets.length) result.push({ publicKey: album.publicKey, title: album.title, eventDate: album.eventDate, description: album.description, assets });
  }
  return result;
}

export async function getPublishedEventMediaDerivative(client: PrismaClient, assetKey: string, audience: "PUBLIC" | "PARENT_PORTAL", guardianId?: string | null) {
  if (audience === "PUBLIC" && !eventMediaPublicGalleryEnabled()) throw new EventMediaError("Public gallery is disabled.", 404, "PUBLIC_GALLERY_DISABLED");
  const asset = await assetByKey(client, assetKey, { album: true, derivatives: { where: { kind: "THUMBNAIL", status: "READY" } }, studentAssociations: true });
  if (asset.album.visibility !== audience || asset.album.status !== "PUBLISHED" || asset.album.publicationState !== "PUBLISHED" || asset.publicationStatus !== "PUBLISHED" || asset.withdrawalState !== "NONE" || asset.archivedAt || asset.album.archivedAt) throw new EventMediaError("The published media derivative is unavailable.", 404, "DERIVATIVE_UNAVAILABLE");
  if (audience === "PARENT_PORTAL") {
    if (!guardianId) throw new EventMediaError("Parent authentication is required.", 403, "PARENT_REQUIRED");
    const links = await client.studentGuardian.findMany({ where: { guardianId }, select: { studentId: true } });
    const linked = new Set(links.map((link: { studentId: string }) => link.studentId));
    if (!asset.studentAssociations.length || asset.studentAssociations.some((association: { studentId: string }) => !linked.has(association.studentId))) throw new EventMediaError("The media derivative is outside this family scope.", 404, "FAMILY_SCOPE_DENIED");
  }
  if (!(await assetHasCurrentConsent(client, asset.id, audience, asset.peopleDeclaration))) throw new EventMediaError("Publication consent is unavailable or revoked.", 404, "CONSENT_UNAVAILABLE");
  const derivative = asset.derivatives[0];
  if (!derivative?.storageKey || !derivative.sha256 || !derivative.mediaType) throw new EventMediaError("The safe derivative is unavailable.", 404, "DERIVATIVE_UNAVAILABLE");
  return derivative;
}

async function assertAlbumReady(tx: Client, album: any, assets: any[]) {
  for (const asset of assets) {
    if (asset.reviewStatus !== "APPROVED") throw new EventMediaError("Every photo must be explicitly approved before album approval or publication.", 409, "MEDIA_REVIEW_INCOMPLETE");
    if (asset.derivativeStatus !== "READY" || !asset.derivatives.some((row: any) => row.kind === "THUMBNAIL" && row.status === "READY")) throw new EventMediaError("Every photo needs a verified safe derivative.", 409, "DERIVATIVE_NOT_READY");
    const eligibility = await calculateEligibility(tx, asset.id, album.visibility, asset.peopleDeclaration);
    await (tx as any).eventMediaAsset.update({ where: { id: asset.id }, data: { publicationEligibility: eligibility } });
    if (eligibility !== "ELIGIBLE") throw new EventMediaError("Consent or people-identification checks are incomplete; publication fails closed.", 409, "CONSENT_INCOMPLETE");
  }
}

async function calculateEligibility(client: Client, assetId: string, visibility: Visibility, peopleDeclaration: string) {
  if (peopleDeclaration === "UNKNOWN") return "BLOCKED_PEOPLE_UNKNOWN";
  if (peopleDeclaration === "NO_STUDENTS" && (await eventMediaStudentIds(client, assetId)).length) return "BLOCKED_PEOPLE_CONFLICT";
  if (visibility === "PRIVATE_LEADERSHIP" || visibility === "INTERNAL_AUTHORISED") return "ELIGIBLE";
  if (peopleDeclaration === "NO_STUDENTS") return "ELIGIBLE";
  return await assetHasCurrentConsent(client, assetId, visibility, peopleDeclaration) ? "ELIGIBLE" : "BLOCKED_CONSENT";
}

async function assetHasCurrentConsent(client: Client, assetId: string, audience: "PARENT_PORTAL" | "PUBLIC", peopleDeclaration: string) {
  const studentIds = await eventMediaStudentIds(client, assetId);
  if (peopleDeclaration === "NO_STUDENTS") return studentIds.length === 0;
  if (peopleDeclaration !== "MANUAL_ASSOCIATIONS_COMPLETE") return false;
  if (!studentIds.length) return false;
  const now = new Date();
  for (const studentId of studentIds) {
    const consent = await (client as any).mediaPublicationConsent.findFirst({ where: { studentId, audience, status: "GRANTED", grantedAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: [{ grantedAt: "desc" }, { createdAt: "desc" }] });
    if (!consent) return false;
  }
  return true;
}

async function eventMediaStudentIds(client: Client, assetId: string) {
  const associations = await (client as any).eventMediaStudentAssociation.findMany({ where: { assetId }, select: { studentId: true } });
  return associations.map((association: { studentId: string }) => association.studentId);
}

async function refreshStudentAssetEligibility(tx: Client, studentId: string, audience: Visibility) {
  const assets = await (tx as any).eventMediaAsset.findMany({ where: { studentAssociations: { some: { studentId } }, album: { visibility: audience } }, include: { album: true } });
  for (const asset of assets) {
    const eligibility = await calculateEligibility(tx, asset.id, asset.album.visibility, asset.peopleDeclaration);
    await (tx as any).eventMediaAsset.update({ where: { id: asset.id }, data: { publicationEligibility: eligibility } });
  }
}

function publicAsset(asset: any) {
  return { publicKey: asset.publicKey, caption: asset.caption, width: asset.derivatives[0]?.width ?? null, height: asset.derivatives[0]?.height ?? null };
}

async function albumByKey(client: Client, albumKey: string) {
  const album = await (client as any).eventMediaAlbum.findUnique({ where: { publicKey: key(albumKey) } });
  if (!album) throw new EventMediaError("The event album was not found.", 404, "ALBUM_NOT_FOUND");
  return album;
}

async function assetByKey(client: Client, assetKey: string, include: Record<string, unknown> = {}) {
  const asset = await (client as any).eventMediaAsset.findUnique({ where: { publicKey: key(assetKey) }, include });
  if (!asset) throw new EventMediaError("The event media asset was not found.", 404, "ASSET_NOT_FOUND");
  return asset;
}

async function audit(client: Client, actor: EventMediaActor, input: { albumId?: string; assetId?: string; consentId?: string; eventType: string; previousState?: string; newState?: string; reason?: string; safe?: Record<string, unknown> }) {
  await (client as any).eventMediaAuditEvent.create({ data: { albumId: input.albumId, assetId: input.assetId, consentId: input.consentId, eventType: input.eventType, actorUserId: actor.id, actorRole: actor.role, previousState: input.previousState, newState: input.newState, reason: input.reason, safeMetadataJson: input.safe ? JSON.stringify(input.safe) : null } });
}

function requireLeadership(actor: EventMediaActor) {
  if (!(["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"] as Role[]).includes(actor.role)) throw new EventMediaError("School leadership authority is required.", 403, "LEADERSHIP_REQUIRED");
}
function invalidTransition(status: string, action: string) { return new EventMediaError(`Album action ${action} is unavailable from ${status}.`, 409, "ALBUM_TRANSITION_INVALID"); }
function object(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new EventMediaError("A valid request object is required."); return value as Record<string, unknown>; }
function key(value: unknown) { const result = String(value ?? "").trim(); if (!/^[A-Za-z0-9-]{20,80}$/.test(result)) throw new EventMediaError("The media reference is invalid.", 404, "INVALID_REFERENCE"); return result; }
function boundedText(value: unknown, minimum: number, maximum: number, label: string) { const result = String(value ?? "").trim().replace(/\s+/g, " "); if (result.length < minimum || result.length > maximum) throw new EventMediaError(`${label} must be ${minimum}-${maximum} characters.`); return result; }
function optionalText(value: unknown, maximum: number, label: string) { const result = String(value ?? "").trim(); if (!result) return null; if (result.length > maximum) throw new EventMediaError(`${label} must be at most ${maximum} characters.`); return result; }
function oneOf<const T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] { const result = String(value ?? "").trim(); if (!allowed.includes(result as T[number])) throw new EventMediaError(`${label} is unsupported.`); return result as T[number]; }
function requiredDate(value: unknown, label: string) { const date = new Date(String(value ?? "")); if (Number.isNaN(date.getTime())) throw new EventMediaError(`${label} is invalid.`); return date; }
