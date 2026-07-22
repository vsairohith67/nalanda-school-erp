import { normalizeAccessionNumber, normalizeLibraryBarcode } from "@/lib/library-accession";

export const STOCK_SCAN_METHODS = ["BARCODE", "ACCESSION", "MANUAL"] as const;
export const STOCK_SCAN_RESULTS = ["MATCHED_EXPECTED", "DUPLICATE_SCAN", "OUT_OF_SCOPE_COPY", "UNKNOWN_VALUE", "WITHDRAWN_COPY", "INVALID_VALUE", "MANUAL_OVERRIDE"] as const;
export const STOCK_DUPLICATE_WINDOW_MS = 1500;

export function normalizeStockScanInput(value: unknown) {
  const normalizedInput = String(value ?? "").trim().toUpperCase();
  if (!normalizedInput || normalizedInput.length > 100) throw new Error("Enter a barcode or accession number up to 100 characters");
  return normalizedInput;
}

export function exactStockScanCandidates(value: unknown, accessionFallback = true) {
  const normalizedInput = normalizeStockScanInput(value);
  let barcode: string | null = null;
  let accession: string | null = null;
  try { barcode = normalizeLibraryBarcode(normalizedInput); } catch { /* safe invalid candidate */ }
  if (accessionFallback) try { accession = normalizeAccessionNumber(normalizedInput); } catch { /* safe invalid candidate */ }
  return { normalizedInput, barcode, accession };
}
