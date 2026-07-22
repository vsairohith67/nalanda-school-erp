import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  noticeAudienceLabel,
  publishedNoticeWhereForChild,
  staffNoticeWhere,
  validateNoticeInput
} from "../lib/notices";
import { emptyEntityResult } from "../lib/restore";
import { restoreNoticesData } from "../lib/restore-database";

const root = path.resolve(__dirname, "..");
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("parent notices", () => {
  it("validates simple All Parents, class, and section notice inputs", () => {
    expect(validateNoticeInput({ title: "Holiday", body: "School is closed.", audienceType: "ALL_PARENTS" }))
      .toMatchObject({ audienceType: "ALL_PARENTS", className: null, section: null });
    expect(validateNoticeInput({ title: "Class note", body: "Bring the workbook.", audienceType: "CLASS", className: "class 6" }))
      .toMatchObject({ audienceType: "CLASS", className: "VI", section: null });
    expect(validateNoticeInput({ title: "Section note", body: "Assembly at 8:30.", audienceType: "SECTION", className: "VI", section: "a" }))
      .toMatchObject({ audienceType: "SECTION", className: "VI", section: "A" });
  });

  it("rejects incomplete audience targeting and invalid expiry order", () => {
    expect(() => validateNoticeInput({ title: "Class", body: "Message", audienceType: "CLASS" }))
      .toThrow("Choose a valid class");
    expect(() => validateNoticeInput({ title: "Section", body: "Message", audienceType: "SECTION", className: "VI" }))
      .toThrow("Choose a section");
    expect(() => validateNoticeInput({
      title: "Dates", body: "Message", audienceType: "ALL_PARENTS",
      publishDate: "2026-06-28T10:00:00.000Z", expiresAt: "2026-06-28T09:00:00.000Z"
    })).toThrow("Expiry date must be later");
  });

  it("builds server-side published, scheduled, expiry, class, and section filters", () => {
    const now = new Date("2026-06-27T10:00:00.000Z");
    const where = publishedNoticeWhereForChild({ className: "VI", section: "A" }, now);
    expect(where).toMatchObject({ status: "PUBLISHED" });
    expect(where.AND).toEqual([
      { OR: [{ publishDate: null }, { publishDate: { lte: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
    ]);
    expect(where.OR).toContainEqual({ audienceType: "ALL_PARENTS" });
    expect(where.OR).toContainEqual({ audienceType: "CLASS", className: "VI" });
    expect(where.OR).toContainEqual({ audienceType: "SECTION", className: "VI", section: "A" });
  });

  it("keeps staff filters allow-listed and produces clear audience labels", () => {
    expect(staffNoticeWhere({ status: "PUBLISHED", audienceType: "CLASS" }))
      .toEqual({ status: "PUBLISHED", audienceType: "CLASS" });
    expect(staffNoticeWhere({ status: "DELETED", audienceType: "PRIVATE" })).toEqual({});
    expect(noticeAudienceLabel({ audienceType: "ALL_PARENTS" })).toBe("All Parents");
    expect(noticeAudienceLabel({ audienceType: "CLASS", className: "VI" })).toBe("Class VI");
    expect(noticeAudienceLabel({ audienceType: "SECTION", className: "VI", section: "A" })).toBe("Class VI-A");
  });

  it("keeps create/edit/publish/archive staff APIs permission-gated and exposes no delete endpoint", () => {
    const collection = source("app/api/notices/route.ts");
    const item = source("app/api/notices/[id]/route.ts");
    expect(collection).toContain('requireApiPermission("VIEW_NOTICES")');
    expect(collection).toContain('requireApiPermission("MANAGE_NOTICES")');
    expect(collection).toContain('hasRolePermission(prisma, auth.user.role, "PUBLISH_NOTICES")');
    expect(item).toContain('action === "publish" || source.status === "PUBLISHED"');
    expect(item).toContain('status: "PUBLISHED"');
    expect(item).toContain('status: "ARCHIVED"');
    expect(item).not.toContain("export async function DELETE");
  });

  it("keeps parent notices server-filtered and parent UI read-only", () => {
    const helper = source("lib/parent-portal.ts");
    const api = source("app/api/parent/dashboard/route.ts");
    const page = source("app/parent/page.tsx");
    expect(helper).toContain("getPublishedNoticesForChild(selectedChild, client)");
    expect(api).toContain('user.role !== "PARENT"');
    expect(page).toContain("No current notices.");
    expect(page).not.toContain("Publish Notice");
    expect(page).not.toContain("Archive");
    expect(page).not.toContain("createdBy");
  });

  it("restores notice records and safely maps optional staff references", async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const client = {
      notice: {
        findUnique: async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
        create: async ({ data }: { data: Record<string, unknown> }) => { rows.set(String(data.id), data); return data; },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const value = { ...rows.get(where.id), ...data };
          rows.set(where.id, value);
          return value;
        }
      }
    };
    const result = { notices: emptyEntityResult() };
    await restoreNoticesData(client as never, { notices: [{
      id: "notice-1", title: "Holiday", body: "School closed.", audienceType: "ALL_PARENTS",
      status: "PUBLISHED", publishDate: "2026-06-27T08:00:00.000Z", createdById: "backup-user"
    }] }, new Map([["backup-user", "local-user"]]), result);
    expect(result.notices.created).toBe(1);
    expect(rows.get("notice-1")).toMatchObject({ status: "PUBLISHED", createdById: "local-user" });
  });
});
