import path from "node:path";
import { PDFDocument } from "pdf-lib";
import sharp, { type Metadata } from "sharp";
import {
  OCR_INPUT_LIMITS,
  OcrScanningError,
  sha256
} from "@/lib/ocr-scanning/contracts";

const MIME_BY_EXTENSION = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".pdf", "application/pdf"]
]);

export type AdmittedOcrDocument = {
  bytes: Buffer;
  mediaType: "image/png" | "image/jpeg" | "application/pdf";
  extension: ".png" | ".jpg" | ".jpeg" | ".pdf";
  safeDisplayName: string;
  byteSize: number;
  sha256: string;
  pageCount: number;
  aggregatePixels: number;
  pages: Array<{ pageNumber: number; width: number; height: number; pixels: number; rotation: 0 | 90 | 180 | 270 }>;
};

function magicType(bytes: Buffer) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

function safeOriginalName(value: string) {
  if (!value || value.length > 255 || /[\\/\u0000-\u001f]/.test(value) || value === "." || value === ".." || value.includes("..")) {
    throw new OcrScanningError("OCR_FILENAME_UNSAFE");
  }
  const extension = path.extname(value).toLowerCase();
  if (!MIME_BY_EXTENSION.has(extension)) throw new OcrScanningError("OCR_FILE_TYPE_UNSUPPORTED", 415);
  return extension as AdmittedOcrDocument["extension"];
}

function boundedPage(pageNumber: number, width: number, height: number, rotation: number) {
  const roundedWidth = Math.ceil(width);
  const roundedHeight = Math.ceil(height);
  const pixels = roundedWidth * roundedHeight;
  if (!Number.isSafeInteger(pixels) || roundedWidth < 1 || roundedHeight < 1 || roundedWidth > OCR_INPUT_LIMITS.maximumDimension || roundedHeight > OCR_INPUT_LIMITS.maximumDimension || pixels > OCR_INPUT_LIMITS.maximumPixelsPerPage) {
    throw new OcrScanningError("OCR_PAGE_RESOURCE_LIMIT_EXCEEDED", 413);
  }
  const normalizedRotation = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  if (![0, 90, 180, 270].includes(normalizedRotation)) throw new OcrScanningError("OCR_PAGE_ROTATION_INVALID");
  return { pageNumber, width: roundedWidth, height: roundedHeight, pixels, rotation: normalizedRotation as 0 | 90 | 180 | 270 };
}

async function imagePages(bytes: Buffer, expectedType: string) {
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, { failOn: "error", limitInputPixels: OCR_INPUT_LIMITS.maximumPixelsPerPage }).metadata();
  } catch {
    throw new OcrScanningError("OCR_IMAGE_DECODER_REJECTED");
  }
  const actualType = metadata.format === "png" ? "image/png" : metadata.format === "jpeg" ? "image/jpeg" : null;
  if (actualType !== expectedType || metadata.pages && metadata.pages !== 1 || !metadata.width || !metadata.height) {
    throw new OcrScanningError("OCR_IMAGE_DECODER_REJECTED");
  }
  return [boundedPage(1, metadata.width, metadata.height, metadata.orientation ? sharpOrientationDegrees(metadata.orientation) : 0)];
}

function sharpOrientationDegrees(orientation: number) {
  if (orientation === 3) return 180;
  if (orientation === 6) return 90;
  if (orientation === 8) return 270;
  return 0;
}

async function pdfPages(bytes: Buffer) {
  let document: PDFDocument;
  try {
    document = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
      throwOnInvalidObject: true
    });
  } catch {
    throw new OcrScanningError("OCR_PDF_PARSER_REJECTED");
  }
  const count = document.getPageCount();
  if (count < 1 || count > OCR_INPUT_LIMITS.maximumPages) throw new OcrScanningError("OCR_PDF_PAGE_LIMIT_EXCEEDED", 413);
  return document.getPages().map((page, index) => {
    const size = page.getSize();
    const scale = 200 / 72;
    return boundedPage(index + 1, size.width * scale, size.height * scale, page.getRotation().angle);
  });
}

export async function admitOcrDocument(input: { bytes: Buffer; filename: string; declaredMime: string }): Promise<AdmittedOcrDocument> {
  if (!Buffer.isBuffer(input.bytes) || input.bytes.length < 5) throw new OcrScanningError("OCR_FILE_EMPTY_OR_TRUNCATED");
  if (input.bytes.length > OCR_INPUT_LIMITS.maximumFileBytes) throw new OcrScanningError("OCR_FILE_TOO_LARGE", 413);
  const extension = safeOriginalName(input.filename);
  const expectedType = MIME_BY_EXTENSION.get(extension)!;
  const declared = String(input.declaredMime ?? "").split(";", 1)[0].trim().toLowerCase();
  const magic = magicType(input.bytes);
  if (declared !== expectedType || magic !== expectedType) throw new OcrScanningError("OCR_EXTENSION_MIME_MAGIC_MISMATCH", 415);
  const pages = expectedType === "application/pdf" ? await pdfPages(input.bytes) : await imagePages(input.bytes, expectedType);
  const aggregatePixels = pages.reduce((sum, page) => sum + page.pixels, 0);
  if (aggregatePixels > OCR_INPUT_LIMITS.maximumAggregatePixels) throw new OcrScanningError("OCR_DOCUMENT_PIXEL_LIMIT_EXCEEDED", 413);
  return {
    bytes: input.bytes,
    mediaType: expectedType as AdmittedOcrDocument["mediaType"],
    extension,
    safeDisplayName: `Private OCR document${extension === ".jpeg" ? ".jpg" : extension}`,
    byteSize: input.bytes.length,
    sha256: sha256(input.bytes),
    pageCount: pages.length,
    aggregatePixels,
    pages
  };
}
