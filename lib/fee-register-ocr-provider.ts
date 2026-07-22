export const OCR_PROVIDER_KINDS = ["MOCK", "MANUAL", "LOCAL_HTTP", "CLOUD_API"] as const;
export const OCR_CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW", "MISSING"] as const;
export const OCR_ALLOWED_FIELDS = [
  "paymentDate", "admissionNumber", "studentName", "className", "section", "amount",
  "paymentMode", "academicTerm", "handwrittenReceiptReference", "registerRemarks"
] as const;

export type OcrProviderKind = (typeof OCR_PROVIDER_KINDS)[number];
export type OcrField = (typeof OCR_ALLOWED_FIELDS)[number];
export type OcrConfidence = (typeof OCR_CONFIDENCE_LEVELS)[number];
export type OcrBoundingBox = { x: number; y: number; width: number; height: number };
export type OcrProviderRow = {
  rowNumber: number;
  boundingBox?: OcrBoundingBox;
  rawText: string;
  fields: Partial<Record<OcrField, string>>;
  confidence: Partial<Record<OcrField, OcrConfidence>>;
};
export type OcrProviderResponse = { rawText: string; confidence: number; rows: OcrProviderRow[] };

export function validateOcrProviderResponse(input: unknown, maximumRows: number): OcrProviderResponse {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("OCR provider returned an invalid response");
  const root = input as Record<string, unknown>;
  assertOnlyKeys(root, ["rawText", "confidence", "rows"], "OCR page");
  const rawText = boundedText(root.rawText, "OCR page text", 50_000, true);
  const confidence = confidenceNumber(root.confidence, "OCR page confidence");
  if (!Array.isArray(root.rows) || root.rows.length > maximumRows) throw new Error("OCR provider returned too many rows");
  const seen = new Set<number>();
  const rows = root.rows.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`OCR row ${index + 1} is invalid`);
    const row = value as Record<string, unknown>;
    assertOnlyKeys(row, ["rowNumber", "boundingBox", "rawText", "fields", "confidence"], `OCR row ${index + 1}`);
    const rowNumber = Number(row.rowNumber);
    if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > maximumRows || seen.has(rowNumber)) {
      throw new Error("OCR row numbers must be unique positive integers");
    }
    seen.add(rowNumber);
    const fields = validateFields(row.fields, index);
    const fieldConfidence = validateFieldConfidence(row.confidence, index);
    return {
      rowNumber,
      ...(row.boundingBox == null ? {} : { boundingBox: validateBoundingBox(row.boundingBox, index) }),
      rawText: boundedText(row.rawText, `OCR row ${index + 1} text`, 2_000, true),
      fields,
      confidence: fieldConfidence
    };
  });
  return { rawText, confidence, rows };
}

export function runFeeRegisterOcrProvider(providerKind: OcrProviderKind, context: { sourceSha256: string; maximumRows: number }) {
  if (providerKind === "MOCK") return validateOcrProviderResponse(mockResponse(context.sourceSha256), context.maximumRows);
  if (providerKind === "MANUAL") return validateOcrProviderResponse({ rawText: "", confidence: 0, rows: [] }, context.maximumRows);
  if (providerKind === "LOCAL_HTTP") throw new Error("LOCAL_HTTP OCR is disabled during Prompt 20B");
  if (providerKind === "CLOUD_API") throw new Error("CLOUD_API OCR is disabled during Prompt 20B");
  throw new Error("Unsupported OCR provider");
}

export function validateLocalOcrEndpoint(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Local OCR endpoint must use HTTP or HTTPS");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) throw new Error("Local OCR endpoint must use a loopback host");
  if (url.username || url.password) throw new Error("Local OCR endpoint must not embed credentials");
  return url.toString();
}

function mockResponse(sourceSha256: string): OcrProviderResponse {
  const variant = Number.parseInt(sourceSha256.slice(0, 2), 16) % 3;
  const amount = variant === 0 ? "1200.00" : variant === 1 ? "1250.00" : "1300.00";
  return {
    rawText: "QA20B synthetic handwritten register page. MOCK output; no image content was interpreted.",
    confidence: 78,
    rows: [
      {
        rowNumber: 1,
        boundingBox: { x: 0.03, y: 0.12, width: 0.94, height: 0.12 },
        rawText: `19/07/2026 QA20B-001 QA20B Student One VI A ${amount} Cash HW-QA20B-001`,
        fields: { paymentDate: "2026-07-19", admissionNumber: "QA20B-001", studentName: "QA20B Student One", className: "6", section: "A", amount, paymentMode: "Cash", academicTerm: "Term 1", handwrittenReceiptReference: "HW-QA20B-001", registerRemarks: "Synthetic MOCK row" },
        confidence: { paymentDate: "HIGH", admissionNumber: "HIGH", studentName: "HIGH", className: "HIGH", section: "HIGH", amount: "MEDIUM", paymentMode: "HIGH", academicTerm: "MEDIUM", handwrittenReceiptReference: "MEDIUM", registerRemarks: "HIGH" }
      },
      {
        rowNumber: 2,
        boundingBox: { x: 0.03, y: 0.26, width: 0.94, height: 0.12 },
        rawText: "18/07/2026 QA20B Duplicate Name VI A 850 UPI HW-QA20B-002",
        fields: { paymentDate: "2026-07-18", studentName: "QA20B Duplicate Name", className: "6", section: "A", amount: "850.00", paymentMode: "UPI", academicTerm: "Term 1", handwrittenReceiptReference: "HW-QA20B-002" },
        confidence: { paymentDate: "HIGH", admissionNumber: "MISSING", studentName: "MEDIUM", className: "HIGH", section: "HIGH", amount: "LOW", paymentMode: "MEDIUM", academicTerm: "MEDIUM", handwrittenReceiptReference: "MEDIUM", registerRemarks: "MISSING" }
      }
    ]
  };
}

function validateFields(value: unknown, index: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`OCR row ${index + 1} fields are invalid`);
  const fields = value as Record<string, unknown>;
  assertOnlyKeys(fields, OCR_ALLOWED_FIELDS, `OCR row ${index + 1} fields`);
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, boundedText(field, `${key}`, key === "registerRemarks" ? 500 : 160)])) as Partial<Record<OcrField, string>>;
}

function validateFieldConfidence(value: unknown, index: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`OCR row ${index + 1} confidence is invalid`);
  const confidence = value as Record<string, unknown>;
  assertOnlyKeys(confidence, OCR_ALLOWED_FIELDS, `OCR row ${index + 1} confidence`);
  return Object.fromEntries(Object.entries(confidence).map(([key, level]) => {
    const normalized = String(level ?? "").toUpperCase();
    if (!OCR_CONFIDENCE_LEVELS.includes(normalized as OcrConfidence)) throw new Error(`${key} confidence is invalid`);
    return [key, normalized];
  })) as Partial<Record<OcrField, OcrConfidence>>;
}

function validateBoundingBox(value: unknown, index: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`OCR row ${index + 1} bounding box is invalid`);
  const box = value as Record<string, unknown>;
  assertOnlyKeys(box, ["x", "y", "width", "height"], `OCR row ${index + 1} bounding box`);
  const result = Object.fromEntries(["x", "y", "width", "height"].map((key) => [key, Number(box[key])])) as OcrBoundingBox;
  if (Object.values(result).some((number) => !Number.isFinite(number) || number < 0 || number > 1)) throw new Error("OCR bounding boxes must use 0 to 1 coordinates");
  if (result.width <= 0 || result.height <= 0 || result.x + result.width > 1.000001 || result.y + result.height > 1.000001) throw new Error("OCR bounding box is outside the page");
  return result;
}

function boundedText(value: unknown, label: string, maximum: number, allowEmpty = false) {
  const text = String(value ?? "").trim();
  if ((!allowEmpty && !text) || text.length > maximum) throw new Error(`${label} is missing or too long`);
  return text;
}

function confidenceNumber(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw new Error(`${label} must be between 0 and 100`);
  return Math.round(number);
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(`${label} contains unsupported fields`);
}
