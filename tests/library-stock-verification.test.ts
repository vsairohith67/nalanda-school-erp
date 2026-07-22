import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";
import { exactStockScanCandidates, normalizeStockScanInput, STOCK_DUPLICATE_WINDOW_MS } from "@/lib/library-stock-scanner";
import { libraryStockCsv, loadLibraryStockReports, stockObservationLabel } from "@/lib/library-stock-reports";
import { applyStockResolution, loadStockSession, normalizeStockSessionNumber, publicStockRecord, summarizeStockRecords, validateStockSessionInput } from "@/lib/library-stock-verification";

const base = { sessionNumber: " lsv 2026 001 ", title: "Annual check", academicYear: "2026-27", verificationDate: "2026-07-16", scopeType: "ALL_ACTIVE_COPIES" };

describe("Library stock-verification foundation", () => {
  it("normalizes session numbers deterministically", () => expect(normalizeStockSessionNumber(" lsv 2026 / 001 ")).toBe("LSV-2026/001"));
  it("validates India-local session dates", () => expect(validateStockSessionInput(base).verificationDate.toISOString()).toContain("2026-07-16"));
  it("requires exact shelf scope", () => expect(() => validateStockSessionInput({ ...base, scopeType: "SHELF" })).toThrow("exact shelf"));
  it("requires exact title scope", () => expect(() => validateStockSessionInput({ ...base, scopeType: "TITLE" })).toThrow("exact Library title"));
  it("requires exact category scope", () => expect(() => validateStockSessionInput({ ...base, scopeType: "CATEGORY" })).toThrow("exact category"));
  it("requires exact subject scope", () => expect(() => validateStockSessionInput({ ...base, scopeType: "SUBJECT" })).toThrow("exact subject"));
  it("normalizes keyboard scanner input", () => expect(normalizeStockScanInput(" bc-001 \n")).toBe("BC-001"));
  it("builds exact barcode and accession candidates without fuzzy text", () => expect(exactStockScanCandidates(" acc 001 ")).toEqual({ normalizedInput: "ACC 001", barcode: "ACC001", accession: "ACC-001" }));
  it("uses the documented short duplicate window", () => expect(STOCK_DUPLICATE_WINDOW_MS).toBe(1500));
  it("masks raw IDs and operational notes in Viewer records", () => expect(publicStockRecord({ id: "raw-id", expectedAccessionNumberSnapshot: "A1", observationNotes: "private", discrepancyReason: "private", resolutionNotes: "private" }, true)).toMatchObject({ id: undefined, observationNotes: null, discrepancyReason: null, resolutionNotes: null }));
  it("does not count unexpected observations as verified expected copies", () => expect(summarizeStockRecords([
    { observationStatus: "PRESENT", resolutionStatus: "NOT_REQUIRED" },
    { observationStatus: "ISSUED_OFFSITE", resolutionStatus: "NOT_REQUIRED" },
    { observationStatus: "KNOWN_REPAIR", resolutionStatus: "NOT_REQUIRED" },
    { observationStatus: "NEEDS_REVIEW", resolutionStatus: "PENDING_REVIEW" },
    { observationStatus: "MISSING", resolutionStatus: "PENDING_REVIEW" },
    { observationStatus: "NOT_CHECKED", resolutionStatus: "NOT_REQUIRED" },
    { observationStatus: "UNEXPECTED", resolutionStatus: "PENDING_REVIEW" }
  ])).toMatchObject({ expectedCopyCount: 6, verifiedCopyCount: 5, unexpectedCount: 1 }));
  it("distinguishes newly proposed and previously missing copies in reports", () => { expect(stockObservationLabel({ observationStatus: "MISSING", expectedStatus: "AVAILABLE" })).toBe("NEWLY_MISSING_PROPOSAL"); expect(stockObservationLabel({ observationStatus: "NEEDS_REVIEW", expectedStatus: "MISSING" })).toBe("EXISTING_MISSING"); });
  it("formula-protects CSV cells", () => { const csv = libraryStockCsv({ totals: {} as never, sessions: [{ sessionNumber: "=BAD", academicYear: "2026-27", verificationDate: new Date("2026-07-16"), status: "LOCKED", scopeType: "SHELF", records: [{ accessionNumber: "+A", correctionApplied: false }] }] } as never); expect(csv).toContain("'=BAD"); expect(csv).toContain("'+A"); });
  it("masks session IDs, actor identity, and scan notes from Viewer payloads", async () => {
    const session = await loadStockSession({ libraryStockVerificationSession: { findUnique: async () => ({ id:"session-id",titleIdFilter:"title-id",records:[],scanEvents:[{resultType:"UNKNOWN_VALUE",scanMethod:"MANUAL",normalizedInput:"X",scannedAt:new Date(),notes:"private",recordedBy:{name:"Named Operator"}}],events:[] }) } } as never,"session-id",true) as any;
    expect(session.id).toBeUndefined(); expect(session.titleIdFilter).toBeUndefined(); expect(session.scanEvents[0]).toMatchObject({ notes:null, actorLabel:"Masked operator" }); expect(JSON.stringify(session)).not.toContain("Named Operator");
  });
  it("masks report session IDs and scan notes for Viewer", async () => {
    const report = await loadLibraryStockReports({ libraryStockVerificationSession: { findMany: async () => [{ id:"session-id",sessionNumber:"LSV-1",title:"QA",academicYear:"2026-27",verificationDate:new Date(),scopeType:"SHELF",shelfCodeFilter:"A",categoryFilter:null,subjectFilter:null,titleIdFilter:null,status:"LOCKED",expectedCopyCount:1,verifiedCopyCount:1,presentCount:1,issuedOffsiteCount:0,knownRepairCount:0,missingCount:0,misShelvedCount:0,damagedCount:0,unexpectedCount:0,unresolvedCount:0,records:[],scanEvents:[{normalizedInput:"BC-1",scanMethod:"BARCODE",resultType:"MATCHED_EXPECTED",scannedAt:new Date(),notes:"private"}]}] } } as never,{},true);
    expect(report.sessions[0].id).toBeUndefined(); expect(report.sessions[0].scanEvents[0].notes).toBeNull();
  });
  it("blocks an approved missing correction while an incident is unresolved", async () => {
    const tx:any={libraryStockVerificationSession:{findUnique:async()=>({status:"REVIEWED"})},libraryStockVerificationRecord:{findFirst:async()=>({id:"r",copyId:"c",resolutionStatus:"APPROVED_MARK_MISSING",appliedCopyEventId:null,resolutionNotes:"Required reason",observedShelfCode:null,observedCondition:null})},libraryIncident:{findFirst:async()=>({incidentNumber:"INC-OPEN"})}};
    const client:any={$transaction:(run:any)=>run(tx)};
    await expect(applyStockResolution(client,"s","r","u")).rejects.toThrow(/INC-OPEN/);
  });
  it("returns an already-applied correction idempotently without creating another event", async () => {
    const tx:any={libraryStockVerificationSession:{findUnique:async()=>({status:"REVIEWED"})},libraryStockVerificationRecord:{findFirst:async()=>({id:"r",copyId:"c",resolutionStatus:"APPLIED",appliedCopyEventId:"event-1"})}};
    const client:any={$transaction:(run:any)=>run(tx)};
    await expect(applyStockResolution(client,"s","r","u")).resolves.toMatchObject({idempotent:true,record:{appliedCopyEventId:"event-1"}});
  });
  it("exposes deliberate recheck and normalized safe unexpected-add paths", () => {
    const forms=readFileSync("components/library-stock-verification-forms.tsx","utf8"); const route=readFileSync("app/api/library/stock-verification/sessions/[id]/scan/route.ts","utf8");
    expect(forms).toContain("Confirm deliberate recheck"); expect(forms).toContain("confirmRecheck"); expect(forms).toContain("Unexpected-copy reason"); expect(forms).toContain("Missing-proposal reason"); expect(route).toContain("exactStockScanCandidates"); expect(route).toContain("publicStockRecord(record)");
  });
  it("renders detailed verification and append-only scan reports", () => { const source=readFileSync("app/library/stock-verification/reports/page.tsx","utf8"); expect(source).toContain("Verification records"); expect(source).toContain("Recent scan events"); expect(source).toContain('className="table-wrap"'); });
  it("removes scanner mutation controls outside an in-progress session", () => { const source=readFileSync("app/library/stock-verification/[id]/scan/page.tsx","utf8"); expect(source).toContain('session.status==="IN_PROGRESS"'); expect(source).toContain("Scanning, manual observations, and missing proposals are disabled"); });
  it("gives Director final lock and withholds it from Admin", () => { expect(can("DIRECTOR", "LOCK_LIBRARY_STOCK_VERIFICATION")).toBe(true); expect(can("ADMIN", "LOCK_LIBRARY_STOCK_VERIFICATION")).toBe(false); });
  it("gives Principal review/report only and blocks scanning/apply", () => { expect(can("PRINCIPAL", "REVIEW_LIBRARY_STOCK_DISCREPANCIES")).toBe(true); expect(can("PRINCIPAL", "VIEW_LIBRARY_STOCK_REPORTS")).toBe(true); expect(can("PRINCIPAL", "SCAN_LIBRARY_STOCK")).toBe(false); expect(can("PRINCIPAL", "APPLY_LIBRARY_STOCK_CORRECTIONS")).toBe(false); });
  it("gives Viewer masked reports only, without session access or export, and blocks finance/portal roles", () => { expect(can("VIEWER", "VIEW_LIBRARY_STOCK_REPORTS")).toBe(true); expect(can("VIEWER", "VIEW_LIBRARY_STOCK_VERIFICATION")).toBe(false); expect(can("VIEWER", "EXPORT_LIBRARY_STOCK_REPORTS")).toBe(false); for (const role of ["ACCOUNTANT", "TEACHER", "PARENT"] as const) expect(can(role, "VIEW_LIBRARY_STOCK_VERIFICATION")).toBe(false); });
  it("hard-blocks Viewer operational session access even if a stale role bundle still grants it", () => { const auth=readFileSync("lib/auth.ts","utf8"); const nav=readFileSync("components/library-nav.tsx","utf8"); expect(auth.match(/user\.role === "VIEWER" && permission === "VIEW_LIBRARY_STOCK_VERIFICATION"/g)).toHaveLength(2); expect(nav).toContain('user?.role !== "VIEWER"'); });
  it("keeps mobile menu, theme, and account actions at a 44px touch target", () => { const css=readFileSync("app/globals.css","utf8"); const iconRule=css.slice(css.indexOf(".icon-button {"),css.indexOf(".icon-button:hover")); expect(iconRule).toContain("width: 44px"); expect(iconRule).toContain("height: 44px"); expect(css).toMatch(/\.user-menu-popover button \{\s*min-height: 44px/); });
  it("keeps stock resolution isolated from fees and financial records", () => { const source = readFileSync("lib/library-stock-verification.ts", "utf8"); for (const forbidden of ["payment.create", "payment.update", "expenseRecord.create", "libraryCharge.create", "miscIncomeReceipt.create"]) expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase()); });
});
