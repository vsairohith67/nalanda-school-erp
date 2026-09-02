import { NextResponse } from "next/server";
import {
  OCR_SCANNING_FOUNDATION_FEATURE,
  operationalReleaseFeatureAvailability
} from "@/lib/release-feature-flag-runtime";

export const OCR_SCANNING_SCHEMA_VERSION = 1;
export const OCR_SCANNING_FLAG_NAME = "OCR_SCANNING_FOUNDATION_1B";

export function ocrScanningAvailability(environment: NodeJS.ProcessEnv = process.env) {
  return operationalReleaseFeatureAvailability(OCR_SCANNING_FOUNDATION_FEATURE, { environment });
}

export function isOcrScanningEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return ocrScanningAvailability(environment).enabled;
}

export function requireOcrScanningForApi() {
  if (isOcrScanningEnabled()) return undefined;
  return NextResponse.json(
    { error: "The requested capability is unavailable.", code: "OCR_SCANNING_UNAVAILABLE" },
    {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
