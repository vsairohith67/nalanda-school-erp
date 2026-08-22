import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { createEventMediaThumbnail, resolveEventMediaStorageKey, validateEventMediaUpload } from "@/lib/event-media-files";
import { eventMediaPublicGalleryEnabled } from "@/lib/event-media";
import { EVENT_MEDIA_ASSET_BACKUP_MAX_TOTAL_BYTES } from "@/lib/event-media-asset-backup";
import { isEventMediaManagementRole } from "@/lib/event-media-api";
import { validateEventMediaBackupRows } from "@/lib/event-media-backup";
import { CLOUD_BACKUP_MAX_PLAINTEXT_BYTES } from "@/lib/cloud-backup-container";
import { can } from "@/lib/permissions";
import { requestBodyLimitBytes } from "@/lib/request-security";

const source = (file: string) => readFileSync(file, "utf8");
const upload = (name: string, type: string, bytes: Uint8Array, size = bytes.length): Pick<File, "name" | "type" | "size" | "arrayBuffer"> => ({ name, type, size, arrayBuffer: async () => Uint8Array.from(bytes).buffer });

afterEach(() => { delete process.env.EVENT_MEDIA_PUBLIC_GALLERY_ENABLED; delete process.env.EVENT_MEDIA_PRIVATE_STORAGE_ROOT; });

describe("Event Media privacy and media governance", () => {
  it("keeps management and publication leadership-only by default", () => {
    for (const role of ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"] as const) {
      expect(can(role, "VIEW_EVENT_MEDIA")).toBe(true);
      expect(can(role, "PUBLISH_EVENT_MEDIA")).toBe(true);
    }
    for (const role of ["TEACHER", "COMPUTER_OPERATOR", "VIEWER", "PARENT"] as const) {
      expect(can(role, "UPLOAD_EVENT_MEDIA")).toBe(false);
      expect(can(role, "PUBLISH_EVENT_MEDIA")).toBe(false);
    }
    expect(can("PARENT", "VIEW_OWN_EVENT_MEDIA")).toBe(true);
    for (const role of ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"] as const) expect(isEventMediaManagementRole(role)).toBe(true);
    for (const role of ["TEACHER", "COMPUTER_OPERATOR", "VIEWER", "PARENT", "STUDENT"] as const) expect(isEventMediaManagementRole(role)).toBe(false);
  });

  it("requires an exact opt-in for the public gallery", () => {
    expect(eventMediaPublicGalleryEnabled()).toBe(false);
    process.env.EVENT_MEDIA_PUBLIC_GALLERY_ENABLED = "TRUE";
    expect(eventMediaPublicGalleryEnabled()).toBe(true);
    process.env.EVENT_MEDIA_PUBLIC_GALLERY_ENABLED = "1";
    expect(eventMediaPublicGalleryEnabled()).toBe(false);
  });

  it("accepts approved image containers and makes a bounded metadata-free derivative", async () => {
    const png = await sharp({ create: { width: 900, height: 500, channels: 4, background: "#8b1e3f" } }).png().toBuffer();
    const validated = await validateEventMediaUpload(upload("synthetic.png", "image/png", png));
    expect(validated).toMatchObject({ mediaType: "image/png", width: 900, height: 500 });
    const thumbnail = await createEventMediaThumbnail(validated);
    const metadata = await sharp(thumbnail.bytes).metadata();
    expect(Math.max(thumbnail.width, thumbnail.height)).toBe(720);
    expect(metadata).toMatchObject({ format: "jpeg" });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
  });

  it("rejects traversal, SVG/script, spoofed MIME, truncation, animation and oversize claims", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 4, background: "white" } }).png().toBuffer();
    await expect(validateEventMediaUpload(upload("../photo.png", "image/png", png))).rejects.toThrow(/unsafe/i);
    await expect(validateEventMediaUpload(upload("payload.svg", "image/svg+xml", Buffer.from("<svg><script>alert(1)</script></svg>")))).rejects.toThrow(/Only PNG/);
    await expect(validateEventMediaUpload(upload("photo.jpg", "image/jpeg", png))).rejects.toThrow(/contents/);
    await expect(validateEventMediaUpload(upload("photo.png", "image/jpeg", png))).rejects.toThrow(/MIME/);
    await expect(validateEventMediaUpload(upload("cut.png", "image/png", png.subarray(0, png.length - 8)))).rejects.toThrow(/truncated|malformed/);
    const animated = Buffer.alloc(30); animated.write("RIFF", 0); animated.writeUInt32LE(22, 4); animated.write("WEBP", 8); animated.write("VP8X", 12); animated[20] = 0x02;
    await expect(validateEventMediaUpload(upload("animated.webp", "image/webp", animated))).rejects.toThrow(/Animated/);
    await expect(validateEventMediaUpload(upload("large.png", "image/png", png, 15 * 1024 * 1024 + 1))).rejects.toThrow(/15 MB/);
    expect(requestBodyLimitBytes("/api/event-media/albums/opaque-album-key/assets")).toBe(16 * 1024 * 1024);
  });

  it("keeps storage outside public paths and rejects direct traversal keys", () => {
    process.env.EVENT_MEDIA_PRIVATE_STORAGE_ROOT = "tmp/event-media-unit-private";
    expect(resolveEventMediaStorageKey("original/aa/bb/00000000-0000-4000-8000-000000000000.png")).toContain("event-media-unit-private");
    expect(() => resolveEventMediaStorageKey("../../public/payload.svg")).toThrow(/invalid/);
    expect(() => resolveEventMediaStorageKey("derivative/aa/bb/not-a-uuid.jpg")).toThrow(/invalid/);
  });

  it("validates linked metadata without image binary material", () => {
    const rows = backupRows();
    expect(() => validateEventMediaBackupRows(rows)).not.toThrow();
    expect(JSON.stringify(rows)).not.toMatch(/data:image|base64|imageBinary/);
    const bad = structuredClone(rows); bad.eventMediaAssets[0].originalStorageKey = "../../public/photo.jpg";
    expect(() => validateEventMediaBackupRows(bad)).toThrow(/StorageKey/);
    const missing = structuredClone(rows); missing.eventMediaAssets[0].albumId = "unknown";
    expect(() => validateEventMediaBackupRows(missing)).toThrow(/album link/);
  });

  it("uses server-side guards, fail-closed consent checks, safe caching and append-only SQL", () => {
    const service = source("lib/event-media.ts"), migration = source("prisma/migrations/20260822113000_event_media_v1_5_foundation/migration.sql");
    for (const evidence of ["PUBLIC_GALLERY_DEFAULT_OFF", "CONSENT_INCOMPLETE", "MANUAL_ASSOCIATIONS_COMPLETE", "PEOPLE_ASSOCIATION_CONFLICT", "BLOCKED_PEOPLE_CONFLICT", "MEDIA_WITHDRAWN_FOR_CONSENT", "eventMediaPublicGalleryEnabled", "assetHasCurrentConsent"]) expect(service).toContain(evidence);
    expect(source("lib/event-media-api.ts")).toContain("private, no-store");
    for (const route of ["app/api/event-media/assets/[assetKey]/file/route.ts", "app/api/parent/event-media/assets/[assetKey]/route.ts"]) expect(source(route)).toContain("EVENT_MEDIA_PRIVATE_HEADERS");
    expect(source("app/api/event-media/public/assets/[assetKey]/route.ts")).toContain("max-age=0, must-revalidate");
    expect(source("app/api/event-media/assets/[assetKey]/route.ts")).not.toContain("export async function DELETE");
    expect(source("components/event-media-workspace.tsx")).toContain("consent.audience === audience");
    for (const trigger of ["EventMediaAsset_original_immutable", "EventMediaAlbum_no_delete", "EventMediaAsset_no_delete", "MediaPublicationConsent_no_delete", "EventMediaAuditEvent_no_update", "EventMediaAuditEvent_no_delete"]) expect(migration).toContain(trigger);
  });

  it("documents encrypted double-restore coverage for originals and derivatives", () => {
    const backup = source("lib/event-media-asset-backup.ts"), docs = source("docs/EVENT_MEDIA_GOVERNANCE.md");
    for (const evidence of ["restoreRoots: [string, string]", "firstRestore.fileDigest !== secondRestore.fileDigest", "row.entry", "originalSha256", "recoveryStatus: \"VERIFIED\""]) expect(backup).toContain(evidence);
    expect(docs).toContain("Logical backup version 43");
    expect(docs).toContain("No face recognition");
    expect(EVENT_MEDIA_ASSET_BACKUP_MAX_TOTAL_BYTES).toBeLessThan(CLOUD_BACKUP_MAX_PLAINTEXT_BYTES - 8 * 1024 * 1024);
  });
});

function backupRows() {
  const at = "2026-08-22T10:00:00.000Z";
  return {
    eventMediaAlbums: [{ id: "album", publicKey: "00000000-0000-4000-8000-000000000001", title: "Synthetic Event", eventDate: at, visibility: "PUBLIC", status: "APPROVED", reviewStatus: "APPROVED", publicationState: "APPROVED", retentionPolicy: "GOVERNED_SCHOOL_MEDIA", createdByUserId: "actor", rowVersion: 1, createdAt: at, updatedAt: at }],
    eventMediaAssets: [{ id: "asset", publicKey: "00000000-0000-4000-8000-000000000002", albumId: "album", originalStorageKey: "original/aa/bb/00000000-0000-4000-8000-000000000003.png", originalMediaType: "image/png", originalExtension: ".png", originalByteSize: 100, originalSha256: "a".repeat(64), originalWidth: 10, originalHeight: 10, uploadActorUserId: "actor", uploadedAt: at, reviewStatus: "APPROVED", peopleDeclaration: "NO_STUDENTS", publicationEligibility: "ELIGIBLE", publicationStatus: "PRIVATE", withdrawalState: "NONE", derivativeStatus: "READY", recoveryStatus: "PENDING", rowVersion: 1, createdAt: at, updatedAt: at }],
    eventMediaDerivatives: [{ id: "derivative", publicKey: "00000000-0000-4000-8000-000000000004", assetId: "asset", kind: "THUMBNAIL", status: "READY", storageKey: "derivative/aa/bb/00000000-0000-4000-8000-000000000005.jpg", mediaType: "image/jpeg", extension: ".jpg", byteSize: 80, sha256: "b".repeat(64), width: 10, height: 10, metadataStripped: true, createdAt: at }],
    eventMediaStudentAssociations: [],
    mediaPublicationConsents: [],
    eventMediaAuditEvents: [{ id: "audit", publicKey: "00000000-0000-4000-8000-000000000006", albumId: "album", assetId: "asset", eventType: "MEDIA_UPLOADED", actorUserId: "actor", actorRole: "DIRECTOR", safeMetadataJson: "{}", eventDate: at, createdAt: at }]
  };
}
