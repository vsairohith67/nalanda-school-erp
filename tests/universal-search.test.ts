import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ROLES } from "../lib/permissions";
import { parseUniversalSearchBody } from "../lib/universal-search-api";
import {
  UNIVERSAL_SEARCH_LIMITS,
  UNIVERSAL_SEARCH_SOURCES,
  assertUniversalSearchActor,
  composeUniversalSearch,
  createUniversalSearchAdapters,
  parseUniversalSearchRequest,
  rankSearchCandidate,
  type UniversalSearchAdapter,
  type UniversalSearchAdapterContext,
  type UniversalSearchResult,
  type UniversalSearchSourceId
} from "../lib/universal-search";

const actor = { id: "super-admin-a", role: "SUPER_ADMIN" as const };
const now = new Date("2026-08-22T00:00:00.000Z");

function context(query: string): UniversalSearchAdapterContext {
  const request = parseUniversalSearchRequest({ query, sources: ["STUDENTS"] });
  return { query: request.query, normalizedQuery: request.normalizedQuery, tokens: request.tokens, perSourceLimit: 6, candidateLimit: 32 };
}

function result(source: UniversalSearchSourceId, title: string, score = 700): UniversalSearchResult {
  return { source, type: source, title, subtitle: "Safe metadata", snippet: null, status: "Active", href: "/students/student-1", score, timestamp: now.toISOString() };
}

function adapter(source: UniversalSearchSourceId, search: UniversalSearchAdapter["search"]): UniversalSearchAdapter {
  return { source, search };
}

function sourceAdapter(client: unknown, source: UniversalSearchSourceId, owner = actor.id) {
  return createUniversalSearchAdapters(client as PrismaClient, owner).find((item) => item.source === source)!;
}

describe("UNIVERSAL-SEARCH-1A permission-scoped deterministic retrieval", () => {
  it("allows only exact SUPER_ADMIN and rejects every released or delegated role", () => {
    expect(() => assertUniversalSearchActor(actor)).not.toThrow();
    for (const role of ROLES.filter((role) => role !== "SUPER_ADMIN")) {
      expect(() => assertUniversalSearchActor({ id: `user-${role}`, role })).toThrow(/exact Super Admin role/i);
    }
    expect(() => assertUniversalSearchActor({ id: "delegated", role: "MARKS_ENTRY_OPERATOR" as never })).toThrow(/exact Super Admin role/i);
    expect(() => assertUniversalSearchActor({ id: "delegated", role: "DELEGATED_CUSTOM_ROLE" as never })).toThrow(/exact Super Admin role/i);
  });

  it("keeps both route and API authorization server-side, exact-role, POST-only and private", () => {
    const page = readFileSync("app/super-admin/search/page.tsx", "utf8");
    const api = readFileSync("app/api/super-admin/search/route.ts", "utf8");
    const apiHelpers = readFileSync("lib/universal-search-api.ts", "utf8");
    expect(page).toContain('requireRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN")');
    expect(api).toContain('requireApiRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN")');
    expect(api).toContain("export async function POST");
    expect(api).not.toMatch(/export async function GET|searchParams/);
    expect(apiHelpers).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(apiHelpers).toContain('"Referrer-Policy": "no-referrer"');
    expect(apiHelpers).toContain("unsafeRequestOriginAllowed(request)");
  });

  it("validates empty, short, long, wildcard-only, malformed filter and unbounded requests", () => {
    for (const input of [
      { query: "" },
      { query: "a" },
      { query: "x".repeat(121) },
      { query: "%_" },
      { query: "Arjun", sources: [] },
      { query: "Arjun", sources: ["STUDENTS", "STUDENTS"] },
      { query: "Arjun", sources: ["UNKNOWN"] },
      { query: "Arjun", sources: "STUDENTS" },
      { query: "Arjun", limit: 61 },
      { query: "Arjun", limit: -1 },
      { query: "Arjun", limit: "500000" },
      { query: "Arjun", sort: "passwordHash" }
    ]) expect(() => parseUniversalSearchRequest(input)).toThrow();
  });

  it("accepts the bounded select-all request emitted by the governed Search UI", async () => {
    const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
    const request = new Request(`${origin}/api/super-admin/search`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ query: "NoMatchSynthetic", sources: UNIVERSAL_SEARCH_SOURCES.map((source) => source.id), limit: 50 })
    });
    Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });
    await expect(parseUniversalSearchBody(request as never)).resolves.toMatchObject({
      query: "NoMatchSynthetic",
      sources: UNIVERSAL_SEARCH_SOURCES.map((source) => source.id),
      limit: 50
    });
  });

  it("handles Unicode, apostrophes, punctuation, SQL-like, script, HTML and path-like text as bounded data", () => {
    for (const query of [
      "अर्जुन",
      "O'Brien",
      "ARJUN-2026/27",
      "SELECT * FROM User WHERE 1=1 --",
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "C:\\private\\student-record"
    ]) {
      const parsed = parseUniversalSearchRequest({ query, sources: ["STUDENTS"], limit: 6 });
      expect(parsed.limit).toBe(6);
      expect(parsed.tokens.length).toBeGreaterThan(0);
      expect(parsed.sources).toEqual(["STUDENTS"]);
    }
  });

  it("ranks exact references above exact titles, prefixes and token matches deterministically", () => {
    const request = parseUniversalSearchRequest({ query: "ADM-0042" });
    expect(rankSearchCandidate(request, { references: ["ADM-0042"], primary: ["Arjun Reddy"] })).toBe(1_000);
    expect(rankSearchCandidate(request, { primary: ["ADM-0042"] })).toBe(900);
    const arjun = parseUniversalSearchRequest({ query: "Arjun" });
    expect(rankSearchCandidate(arjun, { primary: ["Arjun Reddy"] })).toBeGreaterThan(rankSearchCandidate(arjun, { secondary: ["Meeting with Arjun's parent"] }));
    expect(rankSearchCandidate(arjun, { primary: ["Arjun Reddy"] })).toBe(rankSearchCandidate(arjun, { primary: ["arjun reddy"] }));
  });

  it("keeps successful results when another source degrades, times out or is unavailable", async () => {
    const never = new Promise<UniversalSearchResult[]>(() => undefined);
    const request = parseUniversalSearchRequest({ query: "Arjun", sources: ["STUDENTS", "GUARDIANS", "STAFF", "ATTENDANCE"] });
    const response = await composeUniversalSearch(request, [
      adapter("STUDENTS", async () => [result("STUDENTS", "Arjun Reddy")]),
      adapter("GUARDIANS", async () => { throw new Error("private database detail"); }),
      adapter("STAFF", () => never)
    ], { now, timeoutMs: 5 });
    expect(response.results).toHaveLength(1);
    expect(response.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "STUDENTS", state: "OK" }),
      expect.objectContaining({ source: "GUARDIANS", state: "DEGRADED" }),
      expect.objectContaining({ source: "STAFF", state: "TIMEOUT" }),
      expect.objectContaining({ source: "ATTENDANCE", state: "UNAVAILABLE" })
    ]));
    expect(JSON.stringify(response)).not.toContain("private database detail");
  });

  it("classifies every newly cleared candidate as safe metadata only and preserves default-off UNAVAILABLE states", async () => {
    const newSources = ["PARENT_MEETINGS", "TRANSPORT", "CAFETERIA", "KG_REPORTS", "EVENT_MEDIA"] as const;
    expect(UNIVERSAL_SEARCH_SOURCES.filter((source) => newSources.includes(source.id as typeof newSources[number])).map((source) => [source.id, source.coverage])).toEqual([
      ["PARENT_MEETINGS", "SAFE_METADATA_ONLY"],
      ["TRANSPORT", "SAFE_METADATA_ONLY"],
      ["CAFETERIA", "SAFE_METADATA_ONLY"],
      ["KG_REPORTS", "SAFE_METADATA_ONLY"],
      ["EVENT_MEDIA", "SAFE_METADATA_ONLY"]
    ]);

    const searches = [vi.fn(async () => []), vi.fn(async () => []), vi.fn(async () => [])];
    const response = await composeUniversalSearch(
      parseUniversalSearchRequest({ query: "Arjun", sources: ["PARENT_MEETINGS", "TRANSPORT", "CAFETERIA"] }),
      ["PARENT_MEETINGS", "TRANSPORT", "CAFETERIA"].map((source, index) => ({
        source: source as UniversalSearchSourceId,
        availability: () => ({ enabled: false, message: `${source} is DEFAULT-OFF.` }),
        search: searches[index]
      })),
      { now }
    );
    expect(response.sources.every((source) => source.state === "UNAVAILABLE" && source.message?.includes("DEFAULT-OFF"))).toBe(true);
    expect(searches.every((search) => search.mock.calls.length === 0)).toBe(true);
  });

  it("keeps an existing exact high-confidence reference ahead of a new-module exact reference", async () => {
    const response = await composeUniversalSearch(
      parseUniversalSearchRequest({ query: "REF-42", sources: ["STUDENTS", "PARENT_MEETINGS"] }),
      [
        adapter("STUDENTS", async () => [result("STUDENTS", "Existing Student", 1_000)]),
        adapter("PARENT_MEETINGS", async () => [result("PARENT_MEETINGS", "New Meeting", 1_000)])
      ],
      { now }
    );
    expect(response.results.map((item) => item.source)).toEqual(["STUDENTS", "PARENT_MEETINGS"]);
  });

  it("distinguishes no matches from unavailable and caps source and overall results", async () => {
    const request = parseUniversalSearchRequest({ query: "Nothing", sources: ["STUDENTS", "RECENT_ACTIVITY"], limit: 3 });
    const response = await composeUniversalSearch(request, [adapter("STUDENTS", async () => [])], { now });
    expect(response.results).toEqual([]);
    expect(response.sources).toEqual([
      expect.objectContaining({ source: "STUDENTS", state: "EMPTY", count: 0 }),
      expect.objectContaining({ source: "RECENT_ACTIVITY", state: "UNAVAILABLE", count: 0 })
    ]);

    const limited = await composeUniversalSearch(parseUniversalSearchRequest({ query: "Arjun", sources: ["STUDENTS"], limit: 3 }), [
      adapter("STUDENTS", async () => Array.from({ length: 20 }, (_, index) => result("STUDENTS", `Arjun ${index}`, 800 - index)))
    ], { now });
    expect(limited.results).toHaveLength(3);
    expect(limited.truncated).toBe(true);
    expect(limited.limits.maximumOverallLimit).toBe(60);
  });

  it("searches every Priority 1 source using only normalized result fields", async () => {
    const client = {
      student: { findMany: vi.fn(async () => [{ id: "student-db-1", admissionNo: "ADM-42", studentName: "Arjun Reddy", fatherName: "Ravi Reddy", motherName: null, className: "8", section: "A", status: "Active", updatedAt: now, aadhaarNo: "SECRET-AADHAAR", address: "PRIVATE-PATH" }]) },
      admissionEnquiry: { findMany: vi.fn(async () => [{ enquiryNumber: "ENQ-42", guardianName: "Ravi Reddy", childName: "Arjun Reddy", desiredClass: "8", desiredAcademicYear: "2026-27", status: "NEW", updatedAt: now, contactValue: "PRIVATE-CONTACT" }]) },
      admissionApplication: { findMany: vi.fn(async () => []) },
      guardian: { findMany: vi.fn(async () => [{ id: "guardian-db-1", displayName: "Ravi Reddy", primaryMobile: "9876543210", alternateMobile: null, email: "ravi@example.test", relationship: "Father", status: "Active", updatedAt: now, notes: "PRIVATE-NOTE" }]) },
      staffMember: { findMany: vi.fn(async () => [{ id: "staff-db-1", staffCode: "STAFF-42", fullName: "Arjun Rao", displayName: null, designation: "Teacher", department: "Science", status: "ACTIVE", updatedAt: now, emergencyContactMobile: "SECRET" }]) },
      superAdminDiaryEntry: { findMany: vi.fn(async () => [{ title: "Arjun parent meeting", category: "PARENT_MATTER", notes: "Private Arjun follow-up", contextReference: "DIA-42", status: "OPEN", priority: "HIGH", entryDate: now, updatedAt: now, ownerUserId: actor.id }]) },
      superAdminTask: { findMany: vi.fn(async () => [{ title: "Call Arjun Books", description: "Discuss Arjun order", category: "VENDOR", status: "TO_DO", priority: "HIGH", linkedEntityReference: "TASK-42", dueDate: now, updatedAt: now, ownerUserId: actor.id }]) },
      superAdminContact: { findMany: vi.fn(async () => [{ name: "Arjun Books", contactPerson: "Arjun", category: "BOOK_SUPPLIER", phone: "9876543210", alternatePhone: null, email: "arjun@books.test", tagsJson: '["Arjun","books"]', status: "ACTIVE", preferred: true, updatedAt: now, ownerUserId: actor.id, notes: "PASSWORD-HASH-ONLY" }]) }
    };

    const sourceQueries: Array<[UniversalSearchSourceId, string]> = [
      ["STUDENTS", "Arjun"], ["ADMISSIONS", "Arjun"], ["GUARDIANS", "Ravi"], ["STAFF", "STAFF-42"],
      ["DIARY", "Arjun"], ["TASKS", "Arjun"], ["CONTACTS", "Arjun"]
    ];
    const results = [] as UniversalSearchResult[];
    for (const [source, query] of sourceQueries) results.push(...await sourceAdapter(client, source).search(context(query)));
    expect(new Set(results.map((item) => item.source))).toEqual(new Set(sourceQueries.map(([source]) => source)));
    const serialized = JSON.stringify(results);
    for (const prohibited of ["SECRET-AADHAAR", "PRIVATE-PATH", "PRIVATE-CONTACT", "PRIVATE-NOTE", "PASSWORD-HASH-ONLY", actor.id]) {
      expect(serialized).not.toContain(prohibited);
    }
    expect(serialized).toContain("Phone ending 3210");
    expect(serialized).not.toContain("9876543210");
  });

  it("matches every enabled Priority 2 source without searching or returning prohibited detail fields", async () => {
    const client = {
      payment: { findMany: vi.fn(async () => [{ receiptNo: "RCT-42", admissionNo: "ADM-42", studentName: "Arjun Reddy", feeType: "Current Year Fee", isCancelled: false, date: now, amountPaid: "SECRET-FINANCIAL-AMOUNT", receivedAccount: "SECRET-FINANCIAL-ACCOUNT" }]) },
      examination: { findMany: vi.fn(async () => [{ id: "exam-db-1", examCode: "EXAM-42", name: "Arjun Term Examination", examType: "TERM", academicYear: "2026-27", description: "Arjun term assessment", status: "ACTIVE", startDate: now, updatedAt: now, marksPolicy: "SECRET-MARKS-POLICY" }]) },
      studentReportCard: { findMany: vi.fn(async () => [{ id: "report-db-1", reportCardNumber: "REPORT-42", academicYear: "2026-27", className: "8", section: "A", reportType: "TERM", status: "ISSUED", updatedAt: now, student: { studentName: "Arjun Reddy", admissionNo: "ADM-42" }, snapshotJson: "SECRET-REPORT-SNAPSHOT" }]) },
      supportRequest: { findMany: vi.fn(async () => [{ reference: "SUP-42", subject: "Arjun support request", requesterName: "Ravi Reddy", requesterType: "PARENT", linkedReceiptReference: "RCT-42", priority: "NORMAL", status: "OPEN", confidentiality: "STANDARD", receivedAt: now, originalStatement: "SECRET-SUPPORT-STATEMENT", internalNotes: "SECRET-SUPPORT-NOTES" }]) },
      studentDepartureRequest: { findMany: vi.fn(async () => [{ requestNumber: "EXIT-42", verificationReference: "VERIFY-42", departureType: "EARLY_DEPARTURE", status: "REQUESTED", intendedDepartureAt: now, student: { studentName: "Arjun Reddy", admissionNo: "ADM-42", className: "8", section: "A" }, reasonDetail: "SECRET-EXIT-REASON", handoverContact: "SECRET-HANDOVER-CONTACT" }]) },
      schoolCalendarEventVersion: { findMany: vi.fn(async () => [{ title: "Arjun House Event", description: "Arjun safe event description", venue: "School hall", eventType: "ACADEMIC", audienceType: "SCHOOL", status: "PUBLISHED", startsAt: now, internalNotes: "SECRET-EVENT-NOTES" }]) }
    };
    const sourceQueries: Array<[UniversalSearchSourceId, string]> = [
      ["FEES", "RCT-42"],
      ["EXAMINATIONS", "EXAM-42"],
      ["REPORT_CARDS", "REPORT-42"],
      ["SUPPORT", "SUP-42"],
      ["SAFE_EXIT", "EXIT-42"],
      ["EVENTS", "Arjun House"]
    ];
    const results = [] as UniversalSearchResult[];
    for (const [source, query] of sourceQueries) results.push(...await sourceAdapter(client, source).search(context(query)));
    expect(new Set(results.map((item) => item.source))).toEqual(new Set(sourceQueries.map(([source]) => source)));
    const serialized = JSON.stringify(results);
    for (const prohibited of [
      "SECRET-FINANCIAL-AMOUNT", "SECRET-FINANCIAL-ACCOUNT", "SECRET-MARKS-POLICY", "SECRET-REPORT-SNAPSHOT",
      "SECRET-SUPPORT-STATEMENT", "SECRET-SUPPORT-NOTES", "SECRET-EXIT-REASON", "SECRET-HANDOVER-CONTACT", "SECRET-EVENT-NOTES"
    ]) expect(serialized).not.toContain(prohibited);

    for (const [source, prohibitedQuery] of [
      ["FEES", "SECRET-FINANCIAL-AMOUNT"],
      ["EXAMINATIONS", "SECRET-MARKS-POLICY"],
      ["REPORT_CARDS", "SECRET-REPORT-SNAPSHOT"],
      ["SUPPORT", "SECRET-SUPPORT-NOTES"],
      ["SAFE_EXIT", "SECRET-HANDOVER-CONTACT"],
      ["EVENTS", "SECRET-EVENT-NOTES"]
    ] as const) {
      expect(await sourceAdapter(client, source).search(context(prohibitedQuery))).toEqual([]);
    }
  });

  it("searches only approved metadata for Parent Meetings, Transport, Cafeteria, KG Reports and Event Media", async () => {
    const client = {
      parentMeeting: { findMany: vi.fn(async () => [{
        publicKey: "PM-42", academicYear: "2026-27", category: "ACADEMIC_PROGRESS", status: "SCHEDULED", scheduledStartAt: now,
        mode: "IN_PERSON", followUpRequired: true, updatedAt: now,
        student: { studentName: "Arjun Reddy", admissionNo: "ADM-42", className: "8", section: "A" },
        followUps: [{ status: "OPEN", dueDate: now }], subject: "PARENT-SENSITIVE-SUBJECT", requestReason: "PARENT-SENSITIVE-FREE-TEXT",
        cancellationInternalReason: "HIDDEN-CANCELLATION", notes: [{ body: "LEADERSHIP-PRIVATE-NOTE" }]
      }]) },
      transportRoute: { findMany: vi.fn(async () => [{ publicKey: "TR-42", code: "ROUTE-42", name: "North Route", directionMode: "BOTH", status: "ACTIVE", updatedAt: now, vehicle: { registrationCode: "BUS-42", displayName: "Blue Bus" }, driverStaffMember: { personalMobile: "PRIVATE-DRIVER-DATA" } }]) },
      transportVehicle: { findMany: vi.fn(async () => [{ publicKey: "TV-42", registrationCode: "BUS-42", displayName: "Blue Bus", status: "ACTIVE", updatedAt: now }]) },
      transportStop: { findMany: vi.fn(async () => [{ publicKey: "TS-42", code: "STOP-42", name: "School Gate", approvedReference: "APPROVED-42", active: true, updatedAt: now, homeAddress: "HOME-ADDRESS-SENTINEL" }]) },
      transportStudentAssignment: { findMany: vi.fn(async () => [{ publicKey: "TA-42", routeCodeSnapshot: "ROUTE-42", routeNameSnapshot: "North Route", pickupStopSnapshot: "School Gate", dropStopSnapshot: "School Gate", effectiveFrom: now, effectiveTo: null, active: true, updatedAt: now, student: { studentName: "Arjun Reddy", admissionNo: "ADM-42", className: "8", section: "A", address: "HOME-ADDRESS-SENTINEL" } }]) },
      cafeteriaCatalogItem: { findMany: vi.fn(async () => [{ publicKey: "CI-42", code: "ITEM-42", name: "Vegetable Pulao", category: "LUNCH", available: true, status: "ACTIVE", updatedAt: now, dietaryNote: "HEALTH-DIET-SENTINEL", price: "FINANCIAL-INFERENCE-SENTINEL" }]) },
      cafeteriaMenu: { findMany: vi.fn(async () => [{ publicKey: "CM-42", menuDate: now, dayLabel: "Monday", mealPlanName: "STANDARD", status: "ACTIVE", updatedAt: now }]) },
      cafeteriaStudentEnrollment: { findMany: vi.fn(async () => [{ publicKey: "CE-42", effectiveFrom: now, effectiveTo: null, active: true, updatedAt: now, mealPlanName: "HEALTH-DIET-SENTINEL", student: { studentName: "Arjun Reddy", admissionNo: "ADM-42", className: "8", section: "A" } }]) },
      cafeteriaMealRecord: { findMany: vi.fn(async () => [{ publicKey: "MEAL-42", serviceDateKey: "2026-08-24", mealSlot: "LUNCH", recordType: "SERVED", status: "RECORDED", recordedAt: now, student: { studentName: "Arjun Reddy", admissionNo: "ADM-42" }, menuItem: { item: { code: "ITEM-42", name: "Vegetable Pulao", dietaryNote: "HEALTH-DIET-SENTINEL" } } }]) },
      studentReportCard: { findMany: vi.fn(async () => [{ id: "kg-db-42", reportCardNumber: "KG-REPORT-42", academicYear: "2026-27", className: "LKG", section: "A", status: "ISSUED", issuedAt: now, updatedAt: now, student: { studentName: "Arjun Junior", admissionNo: "KG-ADM-42" }, batch: { reportingPeriod: "Evaluations I-V" }, draftDataJson: "KG-RUBRIC-CONTENT-SENTINEL", teacherOverallComment: "KG-ASSESSMENT-SENTINEL" }]) },
      eventMediaAlbum: { findMany: vi.fn(async () => [{ publicKey: "ALBUM-42", title: "STUDENT-IDENTIFYING-ALBUM-TITLE", eventDate: now, visibility: "PRIVATE_LEADERSHIP", status: "APPROVED", reviewStatus: "APPROVED", publicationState: "PRIVATE", updatedAt: now, _count: { assets: 1 }, description: "CONSENT-SENSITIVE-DESCRIPTION", legalHold: false }]) },
      eventMediaAsset: { findMany: vi.fn(async () => [{ publicKey: "MEDIA-42", originalMediaType: "image/jpeg", originalWidth: 1600, originalHeight: 900, reviewStatus: "APPROVED", publicationStatus: "PRIVATE", uploadedAt: now, album: { publicKey: "ALBUM-42", title: "STUDENT-IDENTIFYING-ALBUM-TITLE" }, originalStorageKey: "PRIVATE-STORAGE-KEY", originalSha256: "IMAGE-SHA-SENTINEL", caption: "STUDENT-IDENTIFICATION-SENTINEL", reviewNote: "CONSENT-SENSITIVE-NOTE", peopleDeclaration: "MANUAL_ASSOCIATIONS_COMPLETE", exif: "EXIF-SENTINEL" }]) }
    };

    const cases: Array<[UniversalSearchSourceId, string]> = [
      ["PARENT_MEETINGS", "PM-42"],
      ["TRANSPORT", "ROUTE-42"],
      ["CAFETERIA", "ITEM-42"],
      ["KG_REPORTS", "KG-REPORT-42"],
      ["EVENT_MEDIA", "ALBUM-42"]
    ];
    const results: UniversalSearchResult[] = [];
    for (const [source, query] of cases) results.push(...await sourceAdapter(client, source).search(context(query)));
    expect(new Set(results.map((item) => item.source))).toEqual(new Set(cases.map(([source]) => source)));
    const serialized = JSON.stringify(results);
    for (const forbidden of [
      "PARENT-SENSITIVE-SUBJECT", "PARENT-SENSITIVE-FREE-TEXT", "HIDDEN-CANCELLATION", "LEADERSHIP-PRIVATE-NOTE",
      "PRIVATE-DRIVER-DATA", "HOME-ADDRESS-SENTINEL", "HEALTH-DIET-SENTINEL", "FINANCIAL-INFERENCE-SENTINEL",
      "KG-RUBRIC-CONTENT-SENTINEL", "KG-ASSESSMENT-SENTINEL", "CONSENT-SENSITIVE-DESCRIPTION", "PRIVATE-STORAGE-KEY",
      "IMAGE-SHA-SENTINEL", "STUDENT-IDENTIFICATION-SENTINEL", "STUDENT-IDENTIFYING-ALBUM-TITLE", "CONSENT-SENSITIVE-NOTE", "EXIF-SENTINEL"
    ]) expect(serialized).not.toContain(forbidden);

    for (const [source, forbiddenQuery] of [
      ["PARENT_MEETINGS", "LEADERSHIP-PRIVATE-NOTE"],
      ["TRANSPORT", "PRIVATE-DRIVER-DATA"],
      ["CAFETERIA", "HEALTH-DIET-SENTINEL"],
      ["KG_REPORTS", "KG-RUBRIC-CONTENT-SENTINEL"],
      ["EVENT_MEDIA", "EXIF-SENTINEL"]
    ] as const) expect(await sourceAdapter(client, source).search(context(forbiddenQuery))).toEqual([]);

    const firstCallArgument = (mock: unknown) => (mock as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0];
    expect(JSON.stringify(firstCallArgument(client.parentMeeting.findMany))).not.toMatch(/subject|requestReason|cancellationInternalReason|notes|body/);
    expect(JSON.stringify(firstCallArgument(client.transportRoute.findMany))).not.toMatch(/driverStaffMember|attendantStaffMember|address|mobile/);
    expect(JSON.stringify(firstCallArgument(client.cafeteriaStudentEnrollment.findMany))).not.toMatch(/mealPlanName|health|diet|price|amount/);
    expect(JSON.stringify(firstCallArgument(client.studentReportCard.findMany))).not.toMatch(/draftDataJson|snapshotJson|teacherOverallComment|principalComment|directorComment|finalGrade/i);
    expect(JSON.stringify(firstCallArgument(client.eventMediaAsset.findMany))).not.toMatch(/StorageKey|Sha256|caption|reviewNote|peopleDeclaration|studentAssociations|exif/i);
    expect(JSON.stringify(firstCallArgument(client.eventMediaAlbum.findMany))).not.toMatch(/title|description|studentAssociations|legalHold/i);
  });

  it("derives Diary, Tasks and Contacts owner only from the authenticated actor", async () => {
    const client = {
      superAdminDiaryEntry: { findMany: vi.fn(async () => []) },
      superAdminTask: { findMany: vi.fn(async () => []) },
      superAdminContact: { findMany: vi.fn(async () => []) }
    };
    for (const source of ["DIARY", "TASKS", "CONTACTS"] as const) await sourceAdapter(client, source, "super-admin-a").search(context("owner"));
    for (const delegate of [client.superAdminDiaryEntry, client.superAdminTask, client.superAdminContact]) {
      expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ownerUserId: "super-admin-a" }), take: UNIVERSAL_SEARCH_LIMITS.candidateLimit }));
      const calls = delegate.findMany.mock.calls as unknown as unknown[][];
      expect(JSON.stringify(calls[0]?.[0])).not.toContain("super-admin-b");
    }
  });

  it("does not match prohibited IAM or Contact fields that are absent from the safe adapter contract", async () => {
    const users = { user: { findMany: vi.fn(async () => [{ name: "Safe User", designation: null, role: "ADMIN", lifecycleStatus: "ACTIVE", isActive: true, username: "safe-user", email: null, updatedAt: now, passwordHash: "PASSWORD-HASH-ONLY" }]) } };
    const contacts = { superAdminContact: { findMany: vi.fn(async () => [{ name: "Safe Supplier", contactPerson: null, category: "OTHER", phone: null, alternatePhone: null, email: null, tagsJson: "[]", status: "ACTIVE", preferred: false, updatedAt: now, notes: "PRIVATE-ATTACHMENT-PATH-ONLY" }]) } };
    expect(await sourceAdapter(users, "USERS_IAM").search(context("PASSWORD-HASH-ONLY"))).toEqual([]);
    expect(await sourceAdapter(contacts, "CONTACTS").search(context("PRIVATE-ATTACHMENT-PATH-ONLY"))).toEqual([]);
    const userQuery = (users.user.findMany.mock.calls as unknown as Array<Array<{ select?: unknown }>>)[0]?.[0];
    const contactQuery = (contacts.superAdminContact.findMany.mock.calls as unknown as Array<Array<{ select?: unknown }>>)[0]?.[0];
    expect(JSON.stringify(userQuery?.select)).not.toContain("passwordHash");
    expect(JSON.stringify(contactQuery?.select)).not.toContain("notes");
  });

  it("keeps the service read-only with no AI, provider, export, report generation or query-history write", () => {
    const service = readFileSync("lib/universal-search.ts", "utf8");
    expect(service).not.toMatch(/client\.[a-zA-Z0-9_]+\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/);
    expect(service).not.toMatch(/\bfetch\s*\(|openai|anthropic|gemini|embedding|vector|generateText|notification|provider/i);
    expect(service).not.toMatch(/\$queryRaw|\$executeRaw|generatePdf|createExport|exportReport/i);
    expect(service).toContain("ownerUserId");
    expect(service).toContain("candidateLimit");
    expect(UNIVERSAL_SEARCH_SOURCES.filter((source) => source.priority === 1).every((source) => source.available)).toBe(true);
  });

  it("uses the shared shell, accessible keyboard/result patterns and responsive 44px controls", () => {
    const page = readFileSync("app/super-admin/search/page.tsx", "utf8");
    const workspace = readFileSync("components/universal-search-workspace.tsx", "utf8");
    const css = readFileSync("app/globals.css", "utf8");
    expect(page).toContain("<PageShell");
    expect(workspace).toContain('role="search"');
    expect(workspace).toContain('aria-live="polite"');
    expect(workspace).toContain('event.key === "Escape"');
    expect(workspace).toContain('event.key !== "ArrowDown"');
    expect(workspace).not.toMatch(/alert\(|confirm\(|prompt\(/);
    expect(css).toContain(".universal-search-page :is(button, a, input):focus-visible");
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain("min-height: 44px");
  });
});
