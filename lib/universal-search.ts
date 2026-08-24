import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { CAFETERIA_V1_5, optionalOperationsFeatureEnabled, TRANSPORT_V1_5 } from "@/lib/optional-operations-feature-flags";
import { parentMeetingsEnabled } from "@/lib/parent-meeting-feature";
import {
  UNIVERSAL_SEARCH_LIMITS,
  UNIVERSAL_SEARCH_SOURCES,
  type UniversalSearchRequest,
  type UniversalSearchResponse,
  type UniversalSearchResult,
  type UniversalSearchSourceId,
  type UniversalSearchSourceStatus
} from "@/lib/universal-search-contract";

export { UNIVERSAL_SEARCH_LIMITS, UNIVERSAL_SEARCH_SOURCES } from "@/lib/universal-search-contract";
export type {
  UniversalSearchRequest,
  UniversalSearchResponse,
  UniversalSearchResult,
  UniversalSearchSourceId,
  UniversalSearchSourceState,
  UniversalSearchSourceStatus
} from "@/lib/universal-search-contract";

export type UniversalSearchAdapterContext = Pick<UniversalSearchRequest, "query" | "normalizedQuery" | "tokens"> & {
  perSourceLimit: number;
  candidateLimit: number;
};

export type UniversalSearchAdapter = {
  source: UniversalSearchSourceId;
  availability?: () => { enabled: boolean; message: string | null };
  search(context: UniversalSearchAdapterContext): Promise<UniversalSearchResult[]>;
};

type SearchCandidate = {
  source: UniversalSearchSourceId;
  type: string;
  title: string;
  subtitle: string;
  snippet?: string | null;
  status?: string | null;
  href: string;
  timestamp?: Date | string | null;
  references?: Array<string | null | undefined>;
  primary?: Array<string | null | undefined>;
  secondary?: Array<string | null | undefined>;
};

const SOURCE_BY_ID = new Map(UNIVERSAL_SEARCH_SOURCES.map((source) => [source.id, source]));
const SOURCE_ORDER = new Map(UNIVERSAL_SEARCH_SOURCES.map((source, index) => [source.id, index]));

export class UniversalSearchError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "UNIVERSAL_SEARCH_INVALID") {
    super(message);
  }
}

export function assertUniversalSearchActor(actor: Pick<AuthUser, "id" | "role">) {
  if (!actor.id || actor.role !== "SUPER_ADMIN") {
    throw new UniversalSearchError("Universal Search requires the exact Super Admin role.", 403, "UNIVERSAL_SEARCH_ROLE_DENIED");
  }
}

export function parseUniversalSearchRequest(value: unknown): UniversalSearchRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UniversalSearchError("Search request must be a JSON object.");
  }
  const input = value as Record<string, unknown>;
  const unknownKeys = Object.keys(input).filter((key) => !["query", "sources", "limit"].includes(key));
  if (unknownKeys.length) throw new UniversalSearchError("Search request contains unsupported fields.", 400, "UNIVERSAL_SEARCH_FIELDS_INVALID");
  if (typeof input.query !== "string") throw new UniversalSearchError("Enter a search query.", 400, "UNIVERSAL_SEARCH_QUERY_REQUIRED");
  const query = input.query.trim().replace(/\s+/g, " ");
  if (query.length < UNIVERSAL_SEARCH_LIMITS.minimumQueryLength) {
    throw new UniversalSearchError(`Enter at least ${UNIVERSAL_SEARCH_LIMITS.minimumQueryLength} characters.`, 400, "UNIVERSAL_SEARCH_QUERY_SHORT");
  }
  if (query.length > UNIVERSAL_SEARCH_LIMITS.maximumQueryLength) {
    throw new UniversalSearchError(`Search queries are limited to ${UNIVERSAL_SEARCH_LIMITS.maximumQueryLength} characters.`, 400, "UNIVERSAL_SEARCH_QUERY_LONG");
  }
  const normalizedQuery = normalizeSearchText(query);
  const tokens = [...new Set(normalizedQuery.split(" ").filter((token) => token.length >= 2 && /[\p{L}\p{N}]/u.test(token)))].slice(0, 8);
  if (!tokens.length) throw new UniversalSearchError("Enter letters or numbers to search.", 400, "UNIVERSAL_SEARCH_QUERY_NOT_USEFUL");

  let sources = UNIVERSAL_SEARCH_SOURCES.map((source) => source.id);
  if (input.sources !== undefined) {
    if (!Array.isArray(input.sources) || !input.sources.length || input.sources.length > UNIVERSAL_SEARCH_SOURCES.length) {
      throw new UniversalSearchError("Choose one or more valid source filters.", 400, "UNIVERSAL_SEARCH_SOURCES_INVALID");
    }
    const rawSources = input.sources.map((source) => typeof source === "string" ? source.trim().toUpperCase() : "");
    if (new Set(rawSources).size !== rawSources.length) {
      throw new UniversalSearchError("Duplicate source filters are not allowed.", 400, "UNIVERSAL_SEARCH_SOURCES_DUPLICATE");
    }
    if (rawSources.some((source) => !SOURCE_BY_ID.has(source as UniversalSearchSourceId))) {
      throw new UniversalSearchError("An unknown search source was requested.", 400, "UNIVERSAL_SEARCH_SOURCE_UNKNOWN");
    }
    sources = rawSources as UniversalSearchSourceId[];
  }

  const limit = input.limit === undefined ? UNIVERSAL_SEARCH_LIMITS.defaultOverallLimit : Number(input.limit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > UNIVERSAL_SEARCH_LIMITS.maximumOverallLimit) {
    throw new UniversalSearchError(`Result limit must be between 1 and ${UNIVERSAL_SEARCH_LIMITS.maximumOverallLimit}.`, 400, "UNIVERSAL_SEARCH_LIMIT_INVALID");
  }
  return { query, normalizedQuery, tokens, sources, limit };
}

export async function runUniversalSearch(
  client: PrismaClient,
  actor: Pick<AuthUser, "id" | "role">,
  request: UniversalSearchRequest,
  options: { now?: Date; timeoutMs?: number; adapters?: UniversalSearchAdapter[] } = {}
): Promise<UniversalSearchResponse> {
  assertUniversalSearchActor(actor);
  const adapters = options.adapters ?? createUniversalSearchAdapters(client, actor.id);
  return composeUniversalSearch(request, adapters, options);
}

export async function composeUniversalSearch(
  request: UniversalSearchRequest,
  adapters: UniversalSearchAdapter[],
  options: { now?: Date; timeoutMs?: number } = {}
): Promise<UniversalSearchResponse> {
  const now = options.now ?? new Date();
  const timeoutMs = options.timeoutMs ?? UNIVERSAL_SEARCH_LIMITS.sourceTimeoutMs;
  const bySource = new Map(adapters.map((adapter) => [adapter.source, adapter]));
  const context: UniversalSearchAdapterContext = {
    query: request.query,
    normalizedQuery: request.normalizedQuery,
    tokens: request.tokens,
    perSourceLimit: UNIVERSAL_SEARCH_LIMITS.perSourceLimit,
    candidateLimit: UNIVERSAL_SEARCH_LIMITS.candidateLimit
  };
  const settled = await Promise.all(request.sources.map(async (sourceId) => {
    const definition = SOURCE_BY_ID.get(sourceId)!;
    if (!definition.available) {
      return {
        status: { source: sourceId, label: definition.label, state: "UNAVAILABLE", count: 0, message: unavailableReason(sourceId), href: definition.href } satisfies UniversalSearchSourceStatus,
        results: [] as UniversalSearchResult[]
      };
    }
    const adapter = bySource.get(sourceId);
    if (!adapter) {
      return {
        status: { source: sourceId, label: definition.label, state: "UNAVAILABLE", count: 0, message: "No safe bounded adapter is available.", href: definition.href } satisfies UniversalSearchSourceStatus,
        results: [] as UniversalSearchResult[]
      };
    }
    try {
      const availability = adapter.availability?.();
      if (availability && !availability.enabled) {
        return {
          status: { source: sourceId, label: definition.label, state: "UNAVAILABLE", count: 0, message: availability.message, href: definition.href } satisfies UniversalSearchSourceStatus,
          results: [] as UniversalSearchResult[]
        };
      }
    } catch {
      return {
        status: { source: sourceId, label: definition.label, state: "DEGRADED", count: 0, message: "This source is temporarily degraded; other results remain available.", href: definition.href } satisfies UniversalSearchSourceStatus,
        results: [] as UniversalSearchResult[]
      };
    }
    const outcome = await settleSource(adapter.search(context), timeoutMs);
    if (outcome.kind === "timeout") {
      return {
        status: { source: sourceId, label: definition.label, state: "TIMEOUT", count: 0, message: "This source timed out; other results remain available.", href: definition.href } satisfies UniversalSearchSourceStatus,
        results: [] as UniversalSearchResult[]
      };
    }
    if (outcome.kind === "error") {
      return {
        status: { source: sourceId, label: definition.label, state: "DEGRADED", count: 0, message: "This source is temporarily degraded; other results remain available.", href: definition.href } satisfies UniversalSearchSourceStatus,
        results: [] as UniversalSearchResult[]
      };
    }
    const results = outcome.value.slice(0, UNIVERSAL_SEARCH_LIMITS.perSourceLimit);
    return {
      status: { source: sourceId, label: definition.label, state: results.length ? "OK" : "EMPTY", count: results.length, message: results.length ? null : "No matches in this source.", href: definition.href } satisfies UniversalSearchSourceStatus,
      results
    };
  }));

  const ranked = settled.flatMap((source) => source.results).sort(compareResults);
  const results = ranked.slice(0, request.limit);
  return {
    query: request.query,
    generatedAt: now.toISOString(),
    readOnly: true,
    total: results.length,
    truncated: ranked.length > results.length,
    limits: UNIVERSAL_SEARCH_LIMITS,
    results,
    sources: settled.map((source) => source.status)
  };
}

export function createUniversalSearchAdapters(client: PrismaClient, ownerUserId: string): UniversalSearchAdapter[] {
  return [
    adapter("STUDENTS", async (context) => {
      const rows = await client.student.findMany({
        where: { deletedAt: null, ...textWhere(["admissionNo", "studentName", "fatherName", "motherName", "className"], context.tokens) },
        select: { id: true, admissionNo: true, studentName: true, fatherName: true, motherName: true, className: true, section: true, status: true, updatedAt: true },
        orderBy: [{ status: "asc" }, { studentName: "asc" }],
        take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "STUDENTS", type: "Student", title: row.studentName,
        subtitle: `${row.admissionNo} · ${row.className}${row.section ? `-${row.section}` : ""}`,
        snippet: `Parent / Guardian: ${row.fatherName || row.motherName || "Not recorded"}`,
        status: row.status, href: `/students/${encodeURIComponent(row.id)}/edit`, timestamp: row.updatedAt,
        references: [row.admissionNo], primary: [row.studentName], secondary: [row.fatherName, row.motherName, row.className, row.section]
      }), context), context);
    }),
    adapter("ADMISSIONS", async (context) => {
      const [enquiries, applications] = await Promise.all([
        client.admissionEnquiry.findMany({
          where: { archivedAt: null, ...textWhere(["enquiryNumber", "guardianName", "childName", "desiredClass", "desiredAcademicYear"], context.tokens) },
          select: { enquiryNumber: true, guardianName: true, childName: true, desiredClass: true, desiredAcademicYear: true, status: true, updatedAt: true },
          orderBy: { updatedAt: "desc" }, take: context.candidateLimit
        }),
        client.admissionApplication.findMany({
          where: {
            archivedAt: null,
            AND: context.tokens.map((token) => ({ OR: [
              { applicationNumber: { contains: token } },
              { child: { is: { fullName: { contains: token } } } },
              { guardians: { some: { displayName: { contains: token } } } }
            ] }))
          },
          select: { applicationNumber: true, status: true, updatedAt: true, cycle: { select: { academicYear: true } }, child: { select: { fullName: true, desiredClass: true } }, guardians: { where: { isPrimary: true }, select: { displayName: true }, take: 1 } },
          orderBy: { updatedAt: "desc" }, take: context.candidateLimit
        })
      ]);
      const candidates = [
        ...enquiries.map((row) => candidate({
          source: "ADMISSIONS", type: "Admission enquiry", title: row.childName || row.guardianName,
          subtitle: `${row.enquiryNumber} · ${row.desiredAcademicYear} ${row.desiredClass}`,
          snippet: row.childName ? `Guardian: ${row.guardianName}` : "Child name not recorded",
          status: row.status, href: "/admission-crm", timestamp: row.updatedAt,
          references: [row.enquiryNumber], primary: [row.childName, row.guardianName], secondary: [row.desiredClass, row.desiredAcademicYear]
        })),
        ...applications.map((row) => candidate({
          source: "ADMISSIONS", type: "Admission application", title: row.child?.fullName || "Application details pending",
          subtitle: `${row.applicationNumber} · ${row.cycle.academicYear}${row.child?.desiredClass ? ` · ${row.child.desiredClass}` : ""}`,
          snippet: row.guardians[0]?.displayName ? `Guardian: ${row.guardians[0].displayName}` : null,
          status: row.status, href: "/admission-crm", timestamp: row.updatedAt,
          references: [row.applicationNumber], primary: [row.child?.fullName], secondary: [row.guardians[0]?.displayName, row.child?.desiredClass, row.cycle.academicYear]
        }))
      ];
      return ranked(candidates, context);
    }),
    adapter("GUARDIANS", async (context) => {
      const rows = await client.guardian.findMany({
        where: textWhere(["displayName", "primaryMobile", "alternateMobile", "email", "relationship"], context.tokens),
        select: { id: true, displayName: true, primaryMobile: true, alternateMobile: true, email: true, relationship: true, status: true, updatedAt: true },
        orderBy: [{ status: "asc" }, { displayName: "asc" }], take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "GUARDIANS", type: "Guardian", title: row.displayName,
        subtitle: `${row.relationship} · ${label(row.status)}`,
        snippet: [maskPhone(row.primaryMobile || row.alternateMobile), maskEmail(row.email)].filter(Boolean).join(" · ") || null,
        status: row.status, href: `/guardians/${encodeURIComponent(row.id)}`, timestamp: row.updatedAt,
        primary: [row.displayName], secondary: [row.primaryMobile, row.alternateMobile, row.email, row.relationship]
      }), context), context);
    }),
    adapter("STAFF", async (context) => {
      const rows = await client.staffMember.findMany({
        where: textWhere(["staffCode", "fullName", "displayName", "designation", "department"], context.tokens),
        select: { id: true, staffCode: true, fullName: true, displayName: true, designation: true, department: true, status: true, updatedAt: true },
        orderBy: [{ status: "asc" }, { fullName: "asc" }], take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "STAFF", type: "Staff", title: row.displayName || row.fullName,
        subtitle: [row.staffCode, row.designation, row.department].filter(Boolean).join(" · "),
        status: row.status, href: `/staff/${encodeURIComponent(row.id)}`, timestamp: row.updatedAt,
        references: [row.staffCode], primary: [row.fullName, row.displayName], secondary: [row.designation, row.department]
      }), context), context);
    }),
    adapter("DIARY", async (context) => {
      const rows = await client.superAdminDiaryEntry.findMany({
        where: { ownerUserId, ...textWhere(["title", "category", "notes", "contextReference"], context.tokens) },
        select: { title: true, category: true, notes: true, contextReference: true, status: true, priority: true, entryDate: true, updatedAt: true },
        orderBy: [{ entryDate: "desc" }, { updatedAt: "desc" }], take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "DIARY", type: "Diary entry", title: row.title,
        subtitle: `${label(row.category)} · ${label(row.priority)}`,
        snippet: safeSnippet(row.notes), status: row.status, href: "/super-admin/my-work#diary", timestamp: row.entryDate,
        references: [row.contextReference], primary: [row.title], secondary: [row.category, row.notes]
      }), context), context);
    }),
    adapter("TASKS", async (context) => {
      const rows = await client.superAdminTask.findMany({
        where: { ownerUserId, ...textWhere(["title", "description", "category", "status", "linkedEntityReference"], context.tokens) },
        select: { title: true, description: true, category: true, status: true, priority: true, linkedEntityReference: true, dueDate: true, updatedAt: true },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }], take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "TASKS", type: "Task", title: row.title,
        subtitle: `${label(row.category)} · ${label(row.priority)}`,
        snippet: safeSnippet(row.description), status: row.status, href: "/super-admin/my-work#tasks", timestamp: row.dueDate,
        references: [row.linkedEntityReference], primary: [row.title], secondary: [row.description, row.category, row.status]
      }), context), context);
    }),
    adapter("CONTACTS", async (context) => {
      const rows = await client.superAdminContact.findMany({
        where: { ownerUserId, ...textWhere(["name", "contactPerson", "category", "phone", "alternatePhone", "email", "tagsJson"], context.tokens) },
        select: { name: true, contactPerson: true, category: true, phone: true, alternatePhone: true, email: true, tagsJson: true, status: true, preferred: true, updatedAt: true },
        orderBy: [{ preferred: "desc" }, { name: "asc" }], take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "CONTACTS", type: "Contact / Supplier", title: row.name,
        subtitle: [row.contactPerson, label(row.category), row.preferred ? "Preferred" : null].filter(Boolean).join(" · "),
        snippet: [maskPhone(row.phone || row.alternatePhone), maskEmail(row.email), safeTags(row.tagsJson)].filter(Boolean).join(" · ") || null,
        status: row.status, href: "/super-admin/my-work#contacts", timestamp: row.updatedAt,
        primary: [row.name, row.contactPerson], secondary: [row.category, row.phone, row.alternatePhone, row.email, row.tagsJson]
      }), context), context);
    }),
    adapter("FEES", async (context) => {
      const rows = await client.payment.findMany({
        where: { deletedAt: null, ...textWhere(["receiptNo", "admissionNo", "studentName"], context.tokens) },
        select: { receiptNo: true, admissionNo: true, studentName: true, feeType: true, isCancelled: true, date: true },
        orderBy: { date: "desc" }, take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "FEES", type: "Fee receipt", title: row.receiptNo,
        subtitle: `${row.studentName} · ${row.admissionNo}`,
        snippet: label(row.feeType), status: row.isCancelled ? "CANCELLED" : "ACTIVE",
        href: `/receipts/${encodeURIComponent(row.receiptNo)}/print`, timestamp: row.date,
        references: [row.receiptNo, row.admissionNo], primary: [row.studentName], secondary: [row.feeType]
      }), context), context);
    }),
    adapter("EXAMINATIONS", async (context) => {
      const rows = await client.examination.findMany({
        where: textWhere(["examCode", "name", "examType", "academicYear", "description"], context.tokens),
        select: { id: true, examCode: true, name: true, examType: true, academicYear: true, description: true, status: true, startDate: true, updatedAt: true },
        orderBy: { startDate: "desc" }, take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "EXAMINATIONS", type: "Examination", title: row.name,
        subtitle: `${row.examCode} · ${row.academicYear} · ${label(row.examType)}`,
        snippet: safeSnippet(row.description), status: row.status, href: `/exams/${encodeURIComponent(row.id)}`, timestamp: row.updatedAt,
        references: [row.examCode], primary: [row.name], secondary: [row.examType, row.academicYear, row.description]
      }), context), context);
    }),
    adapter("REPORT_CARDS", async (context) => {
      const rows = await client.studentReportCard.findMany({
        where: { reportType: { not: "KG_RUBRIC" }, AND: context.tokens.map((token) => ({ OR: [
          { reportCardNumber: { contains: token } },
          { academicYear: { contains: token } },
          { className: { contains: token } },
          { student: { is: { studentName: { contains: token } } } },
          { student: { is: { admissionNo: { contains: token } } } }
        ] })) },
        select: { id: true, reportCardNumber: true, academicYear: true, className: true, section: true, reportType: true, status: true, updatedAt: true, student: { select: { studentName: true, admissionNo: true } } },
        orderBy: { updatedAt: "desc" }, take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "REPORT_CARDS", type: "Report card", title: row.student.studentName,
        subtitle: `${row.reportCardNumber} · ${row.className}${row.section ? `-${row.section}` : ""}`,
        snippet: `${row.student.admissionNo} · ${label(row.reportType)} · ${row.academicYear}`,
        status: row.status, href: `/report-cards/${encodeURIComponent(row.id)}`, timestamp: row.updatedAt,
        references: [row.reportCardNumber, row.student.admissionNo], primary: [row.student.studentName], secondary: [row.reportType, row.academicYear, row.className]
      }), context), context);
    }),
    adapter("SUPPORT", async (context) => {
      const rows = await client.supportRequest.findMany({
        where: { archivedAt: null, ...textWhere(["reference", "subject", "requesterName", "linkedReceiptReference"], context.tokens) },
        select: { reference: true, subject: true, requesterName: true, requesterType: true, linkedReceiptReference: true, priority: true, status: true, confidentiality: true, receivedAt: true },
        orderBy: { receivedAt: "desc" }, take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "SUPPORT", type: "Support / Complaint", title: row.subject,
        subtitle: `${row.reference} · ${label(row.priority)}`,
        snippet: `${label(row.requesterType)} · ${label(row.confidentiality)}`,
        status: row.status, href: "/support", timestamp: row.receivedAt,
        references: [row.reference, row.linkedReceiptReference], primary: [row.subject], secondary: [row.requesterName, row.requesterType]
      }), context), context);
    }),
    adapter("SAFE_EXIT", async (context) => {
      const rows = await client.studentDepartureRequest.findMany({
        where: {
          restricted: false,
          AND: context.tokens.map((token) => ({ OR: [
            { requestNumber: { contains: token } },
            { verificationReference: { contains: token } },
            { student: { is: { studentName: { contains: token } } } },
            { student: { is: { admissionNo: { contains: token } } } }
          ] }))
        },
        select: { requestNumber: true, verificationReference: true, departureType: true, status: true, intendedDepartureAt: true, student: { select: { studentName: true, admissionNo: true, className: true, section: true } } },
        orderBy: { intendedDepartureAt: "desc" }, take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "SAFE_EXIT", type: "Safe Exit request", title: row.student.studentName,
        subtitle: `${row.requestNumber} · ${row.student.className}${row.student.section ? `-${row.student.section}` : ""}`,
        snippet: `${row.student.admissionNo} · ${label(row.departureType)}`,
        status: row.status, href: "/student-departures", timestamp: row.intendedDepartureAt,
        references: [row.requestNumber, row.verificationReference, row.student.admissionNo], primary: [row.student.studentName], secondary: [row.departureType]
      }), context), context);
    }),
    adapter("EVENTS", async (context) => {
      const rows = await client.schoolCalendarEventVersion.findMany({
        where: { status: { notIn: ["ARCHIVED"] }, ...textWhere(["title", "description", "venue", "eventType", "audienceType"], context.tokens) },
        select: { title: true, description: true, venue: true, eventType: true, audienceType: true, status: true, startsAt: true },
        orderBy: { startsAt: "desc" }, take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "EVENTS", type: "Calendar event", title: row.title,
        subtitle: `${label(row.eventType)} · ${label(row.audienceType)}`,
        snippet: row.venue ? `Venue: ${safeText(row.venue, 80)}` : safeSnippet(row.description),
        status: row.status, href: "/calendar", timestamp: row.startsAt,
        primary: [row.title], secondary: [row.description, row.venue, row.eventType, row.audienceType]
      }), context), context);
    }),
    adapter("PARENT_MEETINGS", async (context) => {
      const rows = await client.parentMeeting.findMany({
        where: { AND: context.tokens.map((token) => ({ OR: [
          { publicKey: { contains: token } },
          { academicYear: { contains: token } },
          { category: { contains: token } },
          { status: { contains: token } },
          { student: { is: { studentName: { contains: token } } } },
          { student: { is: { admissionNo: { contains: token } } } },
          { followUps: { some: { status: { contains: token } } } }
        ] })) },
        select: {
          publicKey: true, academicYear: true, category: true, status: true, scheduledStartAt: true, mode: true, followUpRequired: true, updatedAt: true,
          student: { select: { studentName: true, admissionNo: true, className: true, section: true } },
          followUps: { select: { status: true, dueDate: true }, orderBy: [{ status: "asc" }, { dueDate: "asc" }], take: 1 }
        },
        orderBy: [{ scheduledStartAt: "desc" }, { updatedAt: "desc" }],
        take: context.candidateLimit
      });
      return ranked(rows.map((row) => {
        const followUp = row.followUps[0];
        return candidate({
          source: "PARENT_MEETINGS", type: "Parent meeting metadata", title: row.student.studentName,
          subtitle: `${row.publicKey} · ${label(row.category)} · ${row.student.className}${row.student.section ? `-${row.student.section}` : ""}`,
          snippet: [
            row.scheduledStartAt ? `Scheduled ${row.scheduledStartAt.toISOString()}` : "Not scheduled",
            row.mode ? label(row.mode) : null,
            followUp ? `Follow-up ${label(followUp.status)} due ${followUp.dueDate.toISOString().slice(0, 10)}` : row.followUpRequired ? "Follow-up required" : "No follow-up required"
          ].filter(Boolean).join(" · "),
          status: row.status, href: "/parent-meetings", timestamp: row.scheduledStartAt ?? row.updatedAt,
          references: [row.publicKey, row.student.admissionNo], primary: [row.student.studentName], secondary: [row.academicYear, row.category, row.status, followUp?.status]
        });
      }), context);
    }, () => ({
      enabled: parentMeetingsEnabled(),
      message: parentMeetingsEnabled() ? null : "Parent Meetings is software-cleared but operationally disabled; no records were queried."
    })),
    adapter("TRANSPORT", async (context) => {
      const [routes, vehicles, stops, assignments] = await Promise.all([
        client.transportRoute.findMany({
          where: { AND: context.tokens.map((token) => ({ OR: [
            { publicKey: { contains: token } }, { code: { contains: token } }, { name: { contains: token } }, { status: { contains: token } },
            { vehicle: { is: { registrationCode: { contains: token } } } }, { vehicle: { is: { displayName: { contains: token } } } }
          ] })) },
          select: { publicKey: true, code: true, name: true, directionMode: true, status: true, updatedAt: true, vehicle: { select: { registrationCode: true, displayName: true } } },
          orderBy: [{ status: "asc" }, { code: "asc" }], take: context.candidateLimit
        }),
        client.transportVehicle.findMany({
          where: textWhere(["publicKey", "registrationCode", "displayName", "status"], context.tokens),
          select: { publicKey: true, registrationCode: true, displayName: true, status: true, updatedAt: true },
          orderBy: [{ status: "asc" }, { displayName: "asc" }], take: context.candidateLimit
        }),
        client.transportStop.findMany({
          where: textWhere(["publicKey", "code", "name", "approvedReference"], context.tokens),
          select: { publicKey: true, code: true, name: true, approvedReference: true, active: true, updatedAt: true },
          orderBy: [{ active: "desc" }, { name: "asc" }], take: context.candidateLimit
        }),
        client.transportStudentAssignment.findMany({
          where: { AND: context.tokens.map((token) => ({ OR: [
            { publicKey: { contains: token } },
            { student: { is: { studentName: { contains: token } } } },
            { student: { is: { admissionNo: { contains: token } } } }
          ] })) },
          select: {
            publicKey: true, routeCodeSnapshot: true, routeNameSnapshot: true, pickupStopSnapshot: true, dropStopSnapshot: true,
            effectiveFrom: true, effectiveTo: true, active: true, updatedAt: true,
            student: { select: { studentName: true, admissionNo: true, className: true, section: true } }
          },
          orderBy: [{ active: "desc" }, { effectiveFrom: "desc" }], take: context.candidateLimit
        })
      ]);
      return ranked([
        ...routes.map((row) => candidate({
          source: "TRANSPORT", type: "Transport route", title: row.name,
          subtitle: `${row.code} · ${row.vehicle.displayName} (${row.vehicle.registrationCode})`,
          snippet: `Direction ${label(row.directionMode)}`, status: row.status, href: "/operations/transport", timestamp: row.updatedAt,
          references: [row.code, row.publicKey, row.vehicle.registrationCode], primary: [row.name], secondary: [row.vehicle.displayName, row.status, row.directionMode]
        })),
        ...vehicles.map((row) => candidate({
          source: "TRANSPORT", type: "Transport vehicle", title: row.displayName,
          subtitle: row.registrationCode, status: row.status, href: "/operations/transport", timestamp: row.updatedAt,
          references: [row.registrationCode, row.publicKey], primary: [row.displayName], secondary: [row.status]
        })),
        ...stops.map((row) => candidate({
          source: "TRANSPORT", type: "Approved transport stop", title: row.name,
          subtitle: row.code, snippet: row.approvedReference ? `Approved reference ${safeText(row.approvedReference, 80)}` : null,
          status: row.active ? "ACTIVE" : "INACTIVE", href: "/operations/transport", timestamp: row.updatedAt,
          references: [row.code, row.publicKey, row.approvedReference], primary: [row.name], secondary: [row.active ? "ACTIVE" : "INACTIVE"]
        })),
        ...assignments.map((row) => candidate({
          source: "TRANSPORT", type: "Student transport assignment", title: row.student.studentName,
          subtitle: `${row.student.admissionNo} · ${row.routeCodeSnapshot} · ${row.routeNameSnapshot}`,
          snippet: `${row.pickupStopSnapshot} to ${row.dropStopSnapshot} · effective ${row.effectiveFrom.toISOString().slice(0, 10)}`,
          status: row.active ? "ACTIVE" : "HISTORICAL", href: "/operations/transport", timestamp: row.updatedAt,
          references: [row.publicKey, row.student.admissionNo], primary: [row.student.studentName], secondary: [row.student.className, row.student.section]
        }))
      ], context);
    }, () => ({
      enabled: optionalOperationsFeatureEnabled(TRANSPORT_V1_5, "SUPER_ADMIN"),
      message: optionalOperationsFeatureEnabled(TRANSPORT_V1_5, "SUPER_ADMIN") ? null : "Transport is software-cleared but DEFAULT-OFF; no records were queried."
    })),
    adapter("CAFETERIA", async (context) => {
      const [items, menus, enrollments, meals] = await Promise.all([
        client.cafeteriaCatalogItem.findMany({
          where: textWhere(["publicKey", "code", "name", "category", "status"], context.tokens),
          select: { publicKey: true, code: true, name: true, category: true, available: true, status: true, updatedAt: true },
          orderBy: [{ available: "desc" }, { name: "asc" }], take: context.candidateLimit
        }),
        client.cafeteriaMenu.findMany({
          where: textWhere(["publicKey", "dayLabel", "mealPlanName", "status"], context.tokens),
          select: { publicKey: true, menuDate: true, dayLabel: true, mealPlanName: true, status: true, updatedAt: true },
          orderBy: { menuDate: "desc" }, take: context.candidateLimit
        }),
        client.cafeteriaStudentEnrollment.findMany({
          where: { AND: context.tokens.map((token) => ({ OR: [
            { publicKey: { contains: token } },
            { student: { is: { studentName: { contains: token } } } },
            { student: { is: { admissionNo: { contains: token } } } }
          ] })) },
          select: { publicKey: true, effectiveFrom: true, effectiveTo: true, active: true, updatedAt: true, student: { select: { studentName: true, admissionNo: true, className: true, section: true } } },
          orderBy: [{ active: "desc" }, { effectiveFrom: "desc" }], take: context.candidateLimit
        }),
        client.cafeteriaMealRecord.findMany({
          where: { AND: context.tokens.map((token) => ({ OR: [
            { publicKey: { contains: token } },
            { student: { is: { studentName: { contains: token } } } },
            { student: { is: { admissionNo: { contains: token } } } }
          ] })) },
          select: {
            publicKey: true, serviceDateKey: true, mealSlot: true, recordType: true, status: true, recordedAt: true,
            student: { select: { studentName: true, admissionNo: true } },
            menuItem: { select: { item: { select: { code: true, name: true } } } }
          },
          orderBy: { recordedAt: "desc" }, take: context.candidateLimit
        })
      ]);
      return ranked([
        ...items.map((row) => candidate({
          source: "CAFETERIA", type: "Cafeteria item", title: row.name,
          subtitle: `${row.code} · ${label(row.category)}`, status: row.available ? row.status : "UNAVAILABLE",
          href: "/operations/cafeteria", timestamp: row.updatedAt,
          references: [row.code, row.publicKey], primary: [row.name], secondary: [row.category, row.status]
        })),
        ...menus.map((row) => candidate({
          source: "CAFETERIA", type: "Cafeteria menu", title: row.dayLabel,
          subtitle: `${row.menuDate.toISOString().slice(0, 10)} · ${label(row.mealPlanName)}`, status: row.status,
          href: "/operations/cafeteria", timestamp: row.updatedAt,
          references: [row.publicKey], primary: [row.dayLabel], secondary: [row.mealPlanName, row.status]
        })),
        ...enrollments.map((row) => candidate({
          source: "CAFETERIA", type: "Student cafeteria enrollment", title: row.student.studentName,
          subtitle: `${row.student.admissionNo} · ${row.student.className}${row.student.section ? `-${row.student.section}` : ""}`,
          snippet: `Effective ${row.effectiveFrom.toISOString().slice(0, 10)}${row.effectiveTo ? ` to ${row.effectiveTo.toISOString().slice(0, 10)}` : ""}`,
          status: row.active ? "ACTIVE" : "HISTORICAL", href: "/operations/cafeteria", timestamp: row.updatedAt,
          references: [row.publicKey, row.student.admissionNo], primary: [row.student.studentName], secondary: [row.student.className, row.student.section]
        })),
        ...meals.map((row) => candidate({
          source: "CAFETERIA", type: "Meal participation metadata", title: row.student.studentName,
          subtitle: `${row.student.admissionNo} · ${row.serviceDateKey} · ${label(row.mealSlot)}`,
          snippet: `${row.menuItem.item.name} (${row.menuItem.item.code}) · ${label(row.recordType)}`,
          status: row.status, href: "/operations/cafeteria", timestamp: row.recordedAt,
          references: [row.publicKey, row.student.admissionNo], primary: [row.student.studentName]
        }))
      ], context);
    }, () => ({
      enabled: optionalOperationsFeatureEnabled(CAFETERIA_V1_5, "SUPER_ADMIN"),
      message: optionalOperationsFeatureEnabled(CAFETERIA_V1_5, "SUPER_ADMIN") ? null : "Cafeteria is software-cleared but DEFAULT-OFF; no records were queried."
    })),
    adapter("KG_REPORTS", async (context) => {
      const rows = await client.studentReportCard.findMany({
        where: { reportType: "KG_RUBRIC", status: "ISSUED", AND: context.tokens.map((token) => ({ OR: [
          { reportCardNumber: { contains: token } },
          { academicYear: { contains: token } },
          { className: { contains: token } },
          { student: { is: { studentName: { contains: token } } } },
          { student: { is: { admissionNo: { contains: token } } } },
          { batch: { is: { reportingPeriod: { contains: token } } } }
        ] })) },
        select: {
          id: true, reportCardNumber: true, academicYear: true, className: true, section: true, status: true, issuedAt: true, updatedAt: true,
          student: { select: { studentName: true, admissionNo: true } },
          batch: { select: { reportingPeriod: true } }
        },
        orderBy: [{ issuedAt: "desc" }, { updatedAt: "desc" }], take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "KG_REPORTS", type: "Issued KG report metadata", title: row.student.studentName,
        subtitle: `${row.reportCardNumber} · ${row.className}${row.section ? `-${row.section}` : ""}`,
        snippet: `${row.student.admissionNo} · ${row.academicYear}${row.batch.reportingPeriod ? ` · ${safeText(row.batch.reportingPeriod, 80)}` : ""}`,
        status: row.status, href: `/report-cards/${encodeURIComponent(row.id)}`, timestamp: row.issuedAt ?? row.updatedAt,
        references: [row.reportCardNumber, row.student.admissionNo], primary: [row.student.studentName], secondary: [row.academicYear, row.className, row.batch.reportingPeriod]
      }), context), context);
    }),
    adapter("EVENT_MEDIA", async (context) => {
      const [albums, assets] = await Promise.all([
        client.eventMediaAlbum.findMany({
          where: { archivedAt: null, AND: context.tokens.map((token) => ({ OR: [
            { publicKey: { contains: token } }, { visibility: { contains: token } },
            { status: { contains: token } }, { reviewStatus: { contains: token } }, { publicationState: { contains: token } }
          ] })) },
          select: { publicKey: true, eventDate: true, visibility: true, status: true, reviewStatus: true, publicationState: true, updatedAt: true, _count: { select: { assets: true } } },
          orderBy: [{ eventDate: "desc" }, { publicKey: "asc" }], take: context.candidateLimit
        }),
        client.eventMediaAsset.findMany({
          where: { archivedAt: null, AND: context.tokens.map((token) => ({ OR: [
            { publicKey: { contains: token } }, { originalMediaType: { contains: token } }, { reviewStatus: { contains: token } },
            { publicationStatus: { contains: token } }, { album: { is: { publicKey: { contains: token } } } }
          ] })) },
          select: {
            publicKey: true, originalMediaType: true, originalWidth: true, originalHeight: true, reviewStatus: true, publicationStatus: true, uploadedAt: true,
            album: { select: { publicKey: true } }
          },
          orderBy: { uploadedAt: "desc" }, take: context.candidateLimit
        })
      ]);
      return ranked([
        ...albums.map((row) => candidate({
          source: "EVENT_MEDIA", type: "Event Media album metadata", title: `Album ${safeText(row.publicKey, 60)}`,
          subtitle: `${row.eventDate.toISOString().slice(0, 10)} · ${label(row.visibility)}`,
          snippet: `${row._count.assets} media item${row._count.assets === 1 ? "" : "s"} · review ${label(row.reviewStatus)}`,
          status: row.publicationState, href: "/event-media", timestamp: row.updatedAt,
          references: [row.publicKey], primary: [], secondary: [row.visibility, row.status, row.reviewStatus, row.publicationState]
        })),
        ...assets.map((row) => candidate({
          source: "EVENT_MEDIA", type: "Event Media item metadata", title: `Media ${safeText(row.publicKey, 36)}`,
          subtitle: `${row.album.publicKey} · ${safeText(row.originalMediaType, 48)}`,
          snippet: `${row.originalWidth}×${row.originalHeight} · review ${label(row.reviewStatus)}`,
          status: row.publicationStatus, href: "/event-media", timestamp: row.uploadedAt,
          references: [row.publicKey, row.album.publicKey], primary: [], secondary: [row.originalMediaType, row.reviewStatus, row.publicationStatus]
        }))
      ], context);
    }),
    adapter("USERS_IAM", async (context) => {
      const rows = await client.user.findMany({
        where: textWhere(["name", "username", "email", "designation", "role", "lifecycleStatus"], context.tokens),
        select: { name: true, designation: true, role: true, lifecycleStatus: true, isActive: true, username: true, email: true, updatedAt: true },
        orderBy: [{ isActive: "desc" }, { name: "asc" }], take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "USERS_IAM", type: "Named user", title: row.name,
        subtitle: [label(row.role), row.designation].filter(Boolean).join(" · "),
        snippet: "Named IAM user metadata", status: row.isActive ? row.lifecycleStatus : "DISABLED",
        href: "/users", timestamp: row.updatedAt,
        primary: [row.name], secondary: [row.username, row.email, row.designation, row.role, row.lifecycleStatus]
      }), context), context);
    }),
    adapter("RELEASE_OPERATIONS", async (context) => {
      const rows = await client.releaseManifest.findMany({
        where: textWhere(["releaseVersion", "environment", "gitCommit", "buildId", "migrationVersion"], context.tokens),
        select: { releaseVersion: true, environment: true, gitCommit: true, buildId: true, migrationVersion: true, isCurrent: true, createdAt: true },
        orderBy: { createdAt: "desc" }, take: context.candidateLimit
      });
      return ranked(rows.map((row) => candidate({
        source: "RELEASE_OPERATIONS", type: "Release manifest", title: row.releaseVersion,
        subtitle: `${label(row.environment)} · build ${safeText(row.buildId, 60)}`,
        snippet: `Commit ${safeText(row.gitCommit, 16)} · migration ${safeText(row.migrationVersion, 40)}`,
        status: row.isCurrent ? "CURRENT" : "HISTORICAL", href: "/release-operations", timestamp: row.createdAt,
        references: [row.releaseVersion, row.gitCommit, row.buildId], primary: [row.releaseVersion], secondary: [row.environment, row.migrationVersion]
      }), context), context);
    }),
    adapter("OBSERVABILITY", async (context) => {
      const [alerts, incidents] = await Promise.all([
        client.operationalAlert.findMany({
          where: textWhere(["titleSafe", "evidenceSummarySafe", "domain", "severity", "status"], context.tokens),
          select: { titleSafe: true, evidenceSummarySafe: true, domain: true, severity: true, status: true, lastSeenAt: true },
          orderBy: { lastSeenAt: "desc" }, take: context.candidateLimit
        }),
        client.operationalIncident.findMany({
          where: textWhere(["incidentNumber", "titleSafe", "summarySafe", "domain", "severity", "status"], context.tokens),
          select: { incidentNumber: true, titleSafe: true, summarySafe: true, domain: true, severity: true, status: true, updatedAt: true },
          orderBy: { updatedAt: "desc" }, take: context.candidateLimit
        })
      ]);
      return ranked([
        ...alerts.map((row) => candidate({
          source: "OBSERVABILITY", type: "Operational alert", title: row.titleSafe,
          subtitle: `${label(row.domain)} · ${label(row.severity)}`, snippet: safeSnippet(row.evidenceSummarySafe),
          status: row.status, href: "/technical-operations", timestamp: row.lastSeenAt,
          primary: [row.titleSafe], secondary: [row.evidenceSummarySafe, row.domain, row.severity, row.status]
        })),
        ...incidents.map((row) => candidate({
          source: "OBSERVABILITY", type: "Operational incident", title: row.titleSafe,
          subtitle: `${row.incidentNumber} · ${label(row.severity)}`, snippet: safeSnippet(row.summarySafe),
          status: row.status, href: "/technical-operations", timestamp: row.updatedAt,
          references: [row.incidentNumber], primary: [row.titleSafe], secondary: [row.summarySafe, row.domain, row.severity, row.status]
        }))
      ], context);
    })
  ];
}

export function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-IN").replace(/[’‘`]/g, "'").replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

export function rankSearchCandidate(context: Pick<UniversalSearchRequest, "normalizedQuery" | "tokens">, fields: { references?: Array<string | null | undefined>; primary?: Array<string | null | undefined>; secondary?: Array<string | null | undefined> }) {
  const references = normalized(fields.references);
  const primary = normalized(fields.primary);
  const secondary = normalized(fields.secondary);
  const query = context.normalizedQuery;
  const all = [...references, ...primary, ...secondary];
  if (references.includes(query)) return 1_000;
  if (primary.includes(query)) return 900;
  if (references.some((value) => value.startsWith(query))) return 860;
  if (primary.some((value) => value.startsWith(query))) return 800;
  if (primary.some((value) => value.includes(query))) return 740;
  if (context.tokens.every((token) => primary.some((value) => words(value).includes(token)))) return 680;
  if (secondary.includes(query)) return 640;
  if (secondary.some((value) => value.startsWith(query))) return 610;
  if (all.some((value) => value.includes(query))) return 580;
  if (context.tokens.every((token) => all.some((value) => words(value).includes(token) || value.includes(token)))) return 520;
  return 0;
}

function adapter(
  source: UniversalSearchSourceId,
  search: UniversalSearchAdapter["search"],
  availability?: UniversalSearchAdapter["availability"]
): UniversalSearchAdapter {
  return { source, search, ...(availability ? { availability } : {}) };
}

function candidate(value: SearchCandidate) {
  return value;
}

function ranked(values: SearchCandidate[], context: UniversalSearchAdapterContext) {
  return values.map((value) => {
    const score = rankSearchCandidate(context, value);
    if (!score) return null;
    return {
      source: value.source,
      type: safeText(value.type, 48),
      title: safeText(value.title, 160),
      subtitle: safeText(value.subtitle, 180),
      snippet: value.snippet ? safeText(value.snippet, 220) : null,
      status: value.status ? safeText(label(value.status), 48) : null,
      href: safeHref(value.href),
      score,
      timestamp: value.timestamp ? new Date(value.timestamp).toISOString() : null
    } satisfies UniversalSearchResult;
  }).filter((value): value is UniversalSearchResult => Boolean(value)).sort(compareResults).slice(0, context.perSourceLimit);
}

function compareResults(left: UniversalSearchResult, right: UniversalSearchResult) {
  return right.score - left.score
    || (SOURCE_ORDER.get(left.source) ?? 999) - (SOURCE_ORDER.get(right.source) ?? 999)
    || left.title.localeCompare(right.title, "en-IN", { sensitivity: "base" })
    || (right.timestamp ?? "").localeCompare(left.timestamp ?? "")
    || left.href.localeCompare(right.href);
}

function textWhere(fields: string[], tokens: string[]) {
  return { AND: tokens.map((token) => ({ OR: fields.map((field) => ({ [field]: { contains: token } })) })) };
}

function normalized(values: Array<string | null | undefined> | undefined) {
  return (values ?? []).map((value) => normalizeSearchText(String(value ?? ""))).filter(Boolean);
}

function words(value: string) {
  return value.split(" ").filter(Boolean);
}

async function settleSource<T>(promise: Promise<T>, timeoutMs: number): Promise<{ kind: "ok"; value: T } | { kind: "error" } | { kind: "timeout" }> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then((value) => ({ kind: "ok" as const, value })).catch(() => ({ kind: "error" as const })),
      new Promise<{ kind: "timeout" }>((resolve) => { timeout = setTimeout(() => resolve({ kind: "timeout" }), timeoutMs); })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function unavailableReason(source: UniversalSearchSourceId) {
  if (source === "ATTENDANCE") return "Attendance has no dedicated safe bounded reference adapter in this phase.";
  if (source === "RECENT_ACTIVITY") return "Unified audit search is deferred until a privacy-safe searchable metadata contract is approved.";
  return "No safe bounded adapter is available.";
}

function safeText(value: unknown, maximum: number) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function safeSnippet(value: unknown) {
  const text = safeText(value, 220);
  return text || null;
}

function safeHref(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || /[\u0000-\u001f]/.test(value)) return "/super-admin/search";
  return value.slice(0, 300);
}

function label(value: unknown) {
  return safeText(value, 80).replaceAll("_", " ").toLocaleLowerCase("en-IN").replace(/\b\p{L}/gu, (character) => character.toLocaleUpperCase("en-IN"));
}

function maskPhone(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `Phone ending ${digits.slice(-4)}` : "Phone recorded";
}

function maskEmail(value: string | null | undefined) {
  if (!value || !value.includes("@")) return "";
  const [local, domain] = value.split("@", 2);
  return `${local.slice(0, 1)}***@${domain}`;
}

function safeTags(value: string) {
  try {
    const tags = JSON.parse(value);
    return Array.isArray(tags) ? tags.slice(0, 3).map((tag) => safeText(tag, 24)).filter(Boolean).join(", ") : "";
  } catch {
    return "";
  }
}
