import type { Prisma, PrismaClient } from "@prisma/client";
import { CLASS_NAMES, normalizeClassName } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const NOTICE_AUDIENCES = ["ALL_PARENTS", "CLASS", "SECTION"] as const;
export const NOTICE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type NoticeAudience = (typeof NOTICE_AUDIENCES)[number];
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];

type NoticeClient = Pick<PrismaClient | Prisma.TransactionClient, "notice">;

export type NoticeInput = {
  title: string;
  body: string;
  audienceType: NoticeAudience;
  className: string | null;
  section: string | null;
  publishDate: Date | null;
  expiresAt: Date | null;
};

export function validateNoticeInput(input: unknown): NoticeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Notice details are required.");
  }
  const source = input as Record<string, unknown>;
  const title = requiredText(source.title, "Title", 160);
  const body = requiredText(source.body, "Notice message", 10_000);
  const audienceType = requiredText(source.audienceType ?? "ALL_PARENTS", "Audience", 40) as NoticeAudience;
  if (!NOTICE_AUDIENCES.includes(audienceType)) throw new Error("Choose a valid notice audience.");

  const rawClass = optionalText(source.className);
  const className = rawClass ? normalizeClassName(rawClass) : null;
  if (audienceType !== "ALL_PARENTS" && (!className || !CLASS_NAMES.includes(className as never))) {
    throw new Error("Choose a valid class for this audience.");
  }
  const section = audienceType === "SECTION" ? optionalText(source.section)?.toUpperCase() ?? null : null;
  if (audienceType === "SECTION" && !section) throw new Error("Choose a section for this audience.");
  if (section && section.length > 20) throw new Error("Section is too long.");

  const publishDate = optionalDate(source.publishDate, "Publish date");
  const expiresAt = optionalDate(source.expiresAt, "Expiry date");
  if (publishDate && expiresAt && expiresAt.getTime() <= publishDate.getTime()) {
    throw new Error("Expiry date must be later than the publish date.");
  }

  return {
    title,
    body,
    audienceType,
    className: audienceType === "ALL_PARENTS" ? null : className,
    section,
    publishDate,
    expiresAt
  };
}

export function staffNoticeWhere(filters: { status?: string | null; audienceType?: string | null }) {
  const where: Prisma.NoticeWhereInput = {};
  if (filters.status && NOTICE_STATUSES.includes(filters.status as NoticeStatus)) where.status = filters.status;
  if (filters.audienceType && NOTICE_AUDIENCES.includes(filters.audienceType as NoticeAudience)) {
    where.audienceType = filters.audienceType;
  }
  return where;
}

export function publishedNoticeWhereForChild(
  child: { className: string; section: string | null },
  now = new Date()
): Prisma.NoticeWhereInput {
  return {
    status: "PUBLISHED",
    AND: [
      { OR: [{ publishDate: null }, { publishDate: { lte: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
    ],
    OR: [
      { audienceType: "ALL_PARENTS" },
      { audienceType: "CLASS", className: child.className },
      ...(child.section
        ? [{ audienceType: "SECTION", className: child.className, section: child.section.toUpperCase() }]
        : [])
    ]
  };
}

export async function getPublishedNoticesForChild(
  child: { className: string; section: string | null },
  client: NoticeClient = prisma,
  now = new Date()
) {
  return client.notice.findMany({
    where: publishedNoticeWhereForChild(child, now),
    select: {
      id: true,
      title: true,
      body: true,
      audienceType: true,
      className: true,
      section: true,
      publishDate: true
    },
    orderBy: [{ publishDate: "desc" }, { createdAt: "desc" }]
  });
}

export function noticeAudienceLabel(notice: {
  audienceType: string;
  className?: string | null;
  section?: string | null;
}) {
  if (notice.audienceType === "CLASS") return `Class ${notice.className}`;
  if (notice.audienceType === "SECTION") return `Class ${notice.className}-${notice.section}`;
  return "All Parents";
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  return text;
}

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function optionalDate(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date and time.`);
  return date;
}
