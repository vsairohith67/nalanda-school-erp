import { createHmac, timingSafeEqual } from "node:crypto";
import type { ReportColourMode } from "@/lib/report-publication-types";

export type ReportDownloadTokenPayload = {
  version: 1;
  kind: "PARENT_REPORT" | "STAFF_PDF_JOB";
  action: "VIEW" | "DOWNLOAD";
  userId: string;
  resource: string;
  mode: ReportColourMode;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export function createReportDownloadToken(
  input: Omit<ReportDownloadTokenPayload, "version" | "issuedAt" | "expiresAt" | "nonce">,
  options: { now?: Date; lifetimeSeconds?: number } = {}
) {
  const now = options.now ?? new Date();
  const lifetimeSeconds = Math.min(15 * 60, Math.max(60, options.lifetimeSeconds ?? 5 * 60));
  const payload: ReportDownloadTokenPayload = {
    version: 1,
    ...input,
    issuedAt: Math.floor(now.getTime() / 1_000),
    expiresAt: Math.floor(now.getTime() / 1_000) + lifetimeSeconds,
    nonce: crypto.randomUUID()
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyReportDownloadToken(
  token: unknown,
  options: { now?: Date } = {}
): ReportDownloadTokenPayload | null {
  const text = String(token ?? "");
  const [encoded, provided, extra] = text.split(".");
  if (!encoded || !provided || extra || encoded.length > 4_000 || provided.length !== 64) return null;
  const expected = signature(encoded);
  const left = Buffer.from(provided, "hex");
  const right = Buffer.from(expected, "hex");
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as
      ReportDownloadTokenPayload;
    const now = Math.floor((options.now ?? new Date()).getTime() / 1_000);
    if (
      payload.version !== 1 ||
      !["PARENT_REPORT", "STAFF_PDF_JOB"].includes(payload.kind) ||
      !["VIEW", "DOWNLOAD"].includes(payload.action) ||
      !["COLOUR", "MONOCHROME"].includes(payload.mode) ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(payload.userId) ||
      !/^[A-Za-z0-9:_-]{1,240}$/.test(payload.resource) ||
      !Number.isInteger(payload.issuedAt) ||
      !Number.isInteger(payload.expiresAt) ||
      payload.issuedAt > now + 60 ||
      payload.expiresAt <= now ||
      payload.expiresAt - payload.issuedAt > 15 * 60 ||
      !payload.nonce
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function signature(value: string) {
  const secret = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET or SESSION_SECRET must be configured with at least 32 characters");
  }
  return createHmac("sha256", secret).update(`report-download:v1:${value}`).digest("hex");
}
