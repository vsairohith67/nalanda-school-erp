import { randomUUID } from "node:crypto";
import {
  configuredPrivateObjectStore,
  modulePrivateObjectKey,
  modulePrivateObjectPrefix,
  type PrivateObjectStore
} from "@/lib/portable-runtime/private-object-store";
import { OCR_INPUT_LIMITS, OcrScanningError, sha256 } from "@/lib/ocr-scanning/contracts";

function extension(value: string) {
  const normalized = value === ".jpeg" ? ".jpg" : value.toLowerCase();
  if (![".png", ".jpg", ".pdf"].includes(normalized)) throw new OcrScanningError("OCR_STORAGE_EXTENSION_INVALID");
  return normalized;
}

export function ocrSourceObjectKey(documentKey: string, sourceExtension: string) {
  return modulePrivateObjectKey("ocr", `${documentKey}/source/${randomUUID().toLowerCase()}${extension(sourceExtension)}`);
}

export function ocrRasterObjectKey(documentKey: string) {
  return modulePrivateObjectKey("ocr", `${documentKey}/derivative/${randomUUID().toLowerCase()}.png`);
}

export async function putOcrSource(input: {
  store?: PrivateObjectStore;
  documentKey: string;
  bytes: Buffer;
  sha256: string;
  mediaType: string;
  sourceExtension: string;
}) {
  const store = input.store ?? configuredPrivateObjectStore();
  const key = ocrSourceObjectKey(input.documentKey, input.sourceExtension);
  return store.putPrivateObject({
    key,
    bytes: input.bytes,
    sha256: input.sha256,
    contentType: input.mediaType,
    contentDisposition: `Private OCR document${extension(input.sourceExtension)}`
  });
}

export async function putOcrRaster(input: {
  store?: PrivateObjectStore;
  documentKey: string;
  bytes: Buffer;
  expectedSha256: string;
}) {
  if (input.bytes.length < 32 || input.bytes.length > OCR_INPUT_LIMITS.maximumFileBytes || !input.bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new OcrScanningError("OCR_RASTER_INVALID", 415);
  }
  if (sha256(input.bytes) !== input.expectedSha256) throw new OcrScanningError("OCR_RASTER_CHECKSUM_MISMATCH", 409);
  const store = input.store ?? configuredPrivateObjectStore();
  const key = ocrRasterObjectKey(input.documentKey);
  return store.putPrivateObject({ key, bytes: input.bytes, sha256: input.expectedSha256, contentType: "image/png" });
}

export async function readOcrPrivateObject(key: string, maximumBytes: number, store: PrivateObjectStore = configuredPrivateObjectStore()) {
  if (!key.startsWith("private/ocr/")) throw new OcrScanningError("OCR_OBJECT_KEY_INVALID", 404);
  return store.getPrivateObject(key, maximumBytes);
}

export async function purgeOcrObjects(documentKey: string, store: PrivateObjectStore = configuredPrivateObjectStore()) {
  const prefix = modulePrivateObjectPrefix("ocr", documentKey);
  const objects = await store.listBoundedPrefix(prefix, 100);
  const failures: string[] = [];
  for (const object of objects) {
    try {
      const result = await store.deleteGovernedObject(object.key, object.version);
      if (!result.deleted) failures.push("OBJECT_DELETE_NOT_CONFIRMED");
    } catch (error) {
      failures.push(error instanceof Error ? error.name : "OBJECT_DELETE_FAILED");
    }
  }
  const remaining = await store.listBoundedPrefix(prefix, 1);
  if (remaining.length) failures.push("OBJECTS_REMAIN_AFTER_DELETE");
  return { confirmed: failures.length === 0, deletedObjects: Math.max(0, objects.length - failures.length), failures };
}
