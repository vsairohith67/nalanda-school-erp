import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ROLES } from "../lib/permissions";
import { assertSuperAdminWorkActor, createContact, createDiaryEntry, createTask, listSuperAdminWork, summarizeSuperAdminWork, taskBucket, updateContact, updateDiaryEntry, updateTask } from "../lib/super-admin-work";

const actor = { id: "super-admin-owner-1", role: "SUPER_ADMIN" as const };
const now = new Date("2026-08-21T06:30:00.000Z");

function diaryRow(overrides: Record<string, unknown> = {}) {
  return { id: "diary-db-1", publicKey: "diary-public-1", ownerUserId: actor.id, title: "Daily review", entryDate: new Date("2026-08-20T18:30:00.000Z"), notesFormat: "PLAIN_STRUCTURED", notes: "Private note body", category: "OPERATIONS", contextModule: null, contextReference: null, status: "OPEN", priority: "NORMAL", followUpDate: null, closedAt: null, createdAt: now, updatedAt: now, ...overrides };
}

function taskRow(overrides: Record<string, unknown> = {}) {
  return { id: "task-db-1", publicKey: "task-public-1", ownerUserId: actor.id, title: "Call supplier", description: "Ask about books", status: "TO_DO", priority: "HIGH", dueDate: new Date("2026-08-20T18:30:00.000Z"), dueTime: "15:00", reminderAt: new Date("2026-08-21T03:30:00.000Z"), category: "VENDOR", linkedModule: "OPERATIONS", linkedEntityType: "Supplier", linkedEntityReference: "SUP-12", completedAt: null, createdAt: now, updatedAt: now, ...overrides };
}

function contactRow(overrides: Record<string, unknown> = {}) {
  return { id: "contact-db-1", publicKey: "contact-public-1", ownerUserId: actor.id, name: "Nalanda Books", contactPerson: "Ravi", category: "BOOK_SUPPLIER", phone: "9876543210", alternatePhone: null, email: null, address: null, website: null, notes: null, status: "ACTIVE", preferred: true, tagsJson: "[\"books\"]", lastContactDate: null, nextFollowUpDate: null, createdAt: now, updatedAt: now, ...overrides };
}

function transactionClient() {
  const tx = {
    superAdminDiaryEntry: {
      create: vi.fn(async ({ data }: any) => diaryRow(data)),
      findFirst: vi.fn(async () => diaryRow()),
      update: vi.fn(async ({ data }: any) => diaryRow(data)),
      findMany: vi.fn(async () => [diaryRow()]),
      count: vi.fn(async () => 0)
    },
    superAdminTask: {
      create: vi.fn(async ({ data }: any) => taskRow(data)),
      findFirst: vi.fn(async () => taskRow()),
      update: vi.fn(async ({ data }: any) => taskRow(data)),
      findMany: vi.fn(async () => [taskRow()]),
      count: vi.fn(async () => 0)
    },
    superAdminContact: {
      create: vi.fn(async ({ data }: any) => contactRow(data)),
      findFirst: vi.fn(async () => contactRow()),
      update: vi.fn(async ({ data }: any) => contactRow(data)),
      findMany: vi.fn(async () => [contactRow()]),
      count: vi.fn(async () => 0)
    },
    superAdminWorkAudit: { create: vi.fn(async ({ data }: any) => ({ id: "audit-1", ...data })) }
  };
  return { ...tx, $transaction: vi.fn(async (work: (client: typeof tx) => unknown) => work(tx)) };
}

describe("Super Admin private work programme", () => {
  it("allows only the exact SUPER_ADMIN role and denies every other released or delegated role", () => {
    expect(() => assertSuperAdminWorkActor(actor)).not.toThrow();
    for (const role of ROLES.filter((role) => role !== "SUPER_ADMIN")) {
      expect(() => assertSuperAdminWorkActor({ id: `user-${role}`, role })).toThrow(/exact Super Admin role/i);
    }
    expect(() => assertSuperAdminWorkActor({ id: "delegated", role: "DELEGATED_CUSTOM_PROFILE" as never })).toThrow(/exact Super Admin role/i);
  });

  it("keeps page and direct API authorization server-side and exact-role", () => {
    const page = readFileSync("app/super-admin/my-work/page.tsx", "utf8");
    const api = readFileSync("app/api/super-admin/my-work/route.ts", "utf8");
    expect(page).toContain('requireRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN")');
    expect(api.match(/requireApiRolePermission\("VIEW_DASHBOARD", "SUPER_ADMIN"\)/g)).toHaveLength(3);
    expect(api).not.toContain("requireApiPermission(");
    expect(readFileSync("lib/super-admin-work-api.ts", "utf8")).toContain('"Cache-Control": "private, no-store, max-age=0"');
  });

  it("lists only the signed-in owner and keeps every list bounded", async () => {
    const client = transactionClient();
    const snapshot = await listSuperAdminWork(client as unknown as PrismaClient, actor);
    expect(snapshot.diary).toHaveLength(1);
    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.contacts).toHaveLength(1);
    for (const delegate of [client.superAdminDiaryEntry, client.superAdminTask, client.superAdminContact]) {
      expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerUserId: actor.id }, take: expect.any(Number) }));
    }
    expect(JSON.stringify(snapshot)).not.toContain("ownerUserId");
    expect(JSON.stringify(snapshot)).not.toContain("diary-db-1");
  });

  it("creates Diary records and audits only privacy-safe metadata", async () => {
    const client = transactionClient();
    const result = await createDiaryEntry(client as unknown as PrismaClient, actor, { title: "Daily review", entryDate: "2026-08-21", notes: "Private note body", category: "OPERATIONS", status: "OPEN", priority: "HIGH", followUpDate: "2026-08-22" });
    expect(result).toMatchObject({ title: "Daily review", entryDate: "2026-08-21", followUpDate: "2026-08-22" });
    expect(client.superAdminDiaryEntry.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerUserId: actor.id, notes: "Private note body" }) }));
    const auditInput = client.superAdminWorkAudit.create.mock.calls[0][0].data;
    expect(auditInput).toMatchObject({ ownerUserId: actor.id, actorUserId: actor.id, eventType: "DIARY_CREATED" });
    expect(JSON.stringify(auditInput)).not.toContain("Private note body");
    expect(auditInput.safeMetadataJson).not.toContain("notes");
  });

  it("edits and closes Diary records without copying the private body to audit", async () => {
    const client = transactionClient();
    const result = await updateDiaryEntry(client as unknown as PrismaClient, actor, "diary-public-1", { title: "Daily review updated", entryDate: "2026-08-21", notes: "Changed private note", category: "COMPLIANCE", status: "CLOSED", priority: "URGENT" });
    expect(result).toMatchObject({ title: "Daily review updated", status: "CLOSED" });
    expect(client.superAdminDiaryEntry.findFirst).toHaveBeenCalledWith({ where: { publicKey: "diary-public-1", ownerUserId: actor.id } });
    const auditInput = client.superAdminWorkAudit.create.mock.calls[0][0].data;
    expect(auditInput.eventType).toBe("DIARY_CLOSED");
    expect(JSON.stringify(auditInput)).not.toContain("Changed private note");
  });

  it("creates, completes and reopens tasks with local reminder storage and no provider side effect", async () => {
    const client = transactionClient();
    const result = await createTask(client as unknown as PrismaClient, actor, { title: "Call supplier", description: "Ask about books", status: "DONE", priority: "HIGH", dueDate: "2026-08-21", dueTime: "15:00", reminderAt: "2026-08-21T09:00", category: "VENDOR", linkedModule: "OPERATIONS", linkedEntityType: "Supplier", linkedEntityReference: "SUP-12" });
    expect(result.status).toBe("DONE");
    expect(client.superAdminTask.create.mock.calls[0][0].data.completedAt).toBeInstanceOf(Date);
    expect(client.superAdminTask.create.mock.calls[0][0].data.reminderAt.toISOString()).toBe("2026-08-21T03:30:00.000Z");
    const source = readFileSync("lib/super-admin-work.ts", "utf8");
    expect(source).not.toMatch(/notificationCampaign|notificationRecipient|WhatsApp|smsEmail|\bfetch\s*\(/);

    client.superAdminTask.findFirst.mockResolvedValueOnce(taskRow({ status: "DONE", completedAt: now }) as never);
    await updateTask(client as unknown as PrismaClient, actor, "task-public-1", { title: "Call supplier", status: "TO_DO", priority: "HIGH", dueDate: "2026-08-21", category: "VENDOR" });
    expect(client.superAdminTask.update.mock.calls[0][0].data.completedAt).toBeNull();
    expect(client.superAdminWorkAudit.create.mock.calls[1][0].data.eventType).toBe("TASK_REOPENED");
  });

  it("fails closed when a public key belongs to another owner", async () => {
    const client = transactionClient();
    client.superAdminTask.findFirst.mockResolvedValueOnce(null as never);
    await expect(updateTask(client as unknown as PrismaClient, actor, "task-owned-by-other", { title: "No leak", status: "TO_DO", priority: "NORMAL", dueDate: "2026-08-21", category: "OTHER" })).rejects.toMatchObject({ status: 404, code: "TASK_NOT_FOUND" });
    expect(client.superAdminTask.findFirst).toHaveBeenCalledWith({ where: { publicKey: "task-owned-by-other", ownerUserId: actor.id } });
    expect(client.superAdminTask.update).not.toHaveBeenCalled();
  });

  it("creates Contacts but refuses directory secrets", async () => {
    const client = transactionClient();
    const contact = await createContact(client as unknown as PrismaClient, actor, { name: "Nalanda Books", category: "BOOK_SUPPLIER", phone: "9876543210", preferred: true, tags: "books, preferred" });
    expect(contact).toMatchObject({ name: "Nalanda Books", preferred: true, tags: ["books", "preferred"] });
    await expect(createContact(client as unknown as PrismaClient, actor, { name: "Unsafe", category: "OTHER", phone: "9876543210", notes: "Banking password: secret" })).rejects.toMatchObject({ code: "CONTACT_SECRET_REFUSED" });
  });

  it("updates Contacts inside owner scope and records only safe directory metadata", async () => {
    const client = transactionClient();
    const contact = await updateContact(client as unknown as PrismaClient, actor, "contact-public-1", { name: "Nalanda Books", category: "PUBLISHER", phone: "9876543210", status: "INACTIVE", preferred: false, tags: ["publisher"] });
    expect(contact).toMatchObject({ category: "PUBLISHER", status: "INACTIVE", preferred: false });
    expect(client.superAdminContact.findFirst).toHaveBeenCalledWith({ where: { publicKey: "contact-public-1", ownerUserId: actor.id } });
    expect(client.superAdminWorkAudit.create.mock.calls[0][0].data).toMatchObject({ eventType: "CONTACT_UPDATED", previousStatus: "ACTIVE", newStatus: "INACTIVE" });
  });

  it("classifies date boundaries using the school date instead of runtime locale", () => {
    expect(taskBucket({ status: "TO_DO", dueDate: "2026-08-21" }, now)).toBe("TODAY");
    expect(taskBucket({ status: "WAITING", dueDate: "2026-08-20" }, now)).toBe("OVERDUE");
    expect(taskBucket({ status: "IN_PROGRESS", dueDate: "2026-08-22" }, now)).toBe("UPCOMING");
    expect(taskBucket({ status: "DONE", dueDate: "2026-08-19" }, now)).toBe("COMPLETED");
  });

  it("builds bounded owner-only Command Center summaries", async () => {
    const client = transactionClient();
    client.superAdminTask.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(3);
    client.superAdminDiaryEntry.count.mockResolvedValueOnce(1);
    client.superAdminContact.count.mockResolvedValueOnce(2).mockResolvedValueOnce(7).mockResolvedValueOnce(4);
    client.superAdminDiaryEntry.findMany.mockResolvedValueOnce([diaryRow({ title: "Review", entryDate: new Date("2026-08-20T18:30:00.000Z") })] as never);
    client.superAdminTask.findMany.mockResolvedValueOnce([taskRow()] as never);
    const summary = await summarizeSuperAdminWork(client as unknown as PrismaClient, actor, now);
    expect(summary).toMatchObject({ todayTasks: 2, overdueTasks: 1, upcomingReminders: 3, followUpsDue: 3, activeContacts: 7, preferredContacts: 4 });
    expect(summary.recentDiary).toHaveLength(1);
    expect(summary.reminderItems).toHaveLength(1);
    for (const delegate of [client.superAdminDiaryEntry, client.superAdminTask, client.superAdminContact]) {
      for (const call of [...delegate.count.mock.calls, ...delegate.findMany.mock.calls]) expect(JSON.stringify((call as unknown[])[0])).toContain(actor.id);
    }
  });

  it("uses accessible responsive patterns and no native dialogs", () => {
    const workspace = readFileSync("components/super-admin-workspace.tsx", "utf8");
    const loading = readFileSync("app/super-admin/my-work/loading.tsx", "utf8");
    const css = readFileSync("app/globals.css", "utf8");
    expect(workspace).toContain('aria-label="My Work sections"');
    expect(workspace).toContain('aria-live="polite"');
    expect(workspace).not.toMatch(/alert\(|confirm\(|prompt\(/);
    expect(loading).toContain('aria-busy="true"');
    expect(css).toContain(".my-work-page :is(button, a, input, select, textarea):focus-visible");
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain("min-height: 44px");
  });
});
