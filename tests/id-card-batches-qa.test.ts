import { describe, expect, it } from "vitest";
import { previewIdentityCardBatch } from "@/lib/id-card-batches";

function previewClient(batch: any, candidates: { enrollments?: any[]; staff?: any[] }) {
  let numberAllocationCalls = 0;
  const client: any = {
    $transaction: async (work: (tx: any) => unknown) => work(client),
    identityCardBatch: {
      findUnique: async () => ({ ...batch, template: { id: "tpl", status: "ACTIVE" } }),
      update: async ({ data }: any) => ({ ...batch, ...data })
    },
    academicYearEnrollment: { findMany: async () => candidates.enrollments ?? [] },
    staffMember: { findMany: async () => candidates.staff ?? [] },
    identityCard: { findMany: async () => [] },
    identityCardEvent: { create: async () => ({}) },
    identityCardNumberSeries: {
      get findMany() {
        numberAllocationCalls++;
        return async () => [];
      }
    }
  };
  return { client, get numberAllocationCalls() { return numberAllocationCalls; } };
}

describe("Prompt 18C batch preview safety", () => {
  it("shows inactive Student enrollment reasons without creating cards or allocating numbers", async () => {
    const fake = previewClient(
      { id: "batch", cardType: "STUDENT", academicYear: "2026-27", scopeType: "CLASS_SECTION", className: "10", section: "B", status: "DRAFT" },
      { enrollments: [
        { studentId: "active", className: "10", section: "B", status: "ACTIVE", student: { studentName: "Active", admissionNo: "A", deletedAt: null } },
        { studentId: "inactive", className: "10", section: "B", status: "INACTIVE", student: { studentName: "Inactive", admissionNo: "I", deletedAt: null } }
      ] }
    );
    const result = await previewIdentityCardBatch(fake.client, "batch", "actor");
    expect(result.rows).toMatchObject([
      { label: "Active", eligible: true, reason: null },
      { label: "Inactive", eligible: false, reason: "Enrollment is INACTIVE" }
    ]);
    expect(result.batch).toMatchObject({ expectedCount: 2, eligibleCount: 1, skippedCount: 1 });
    expect(fake.numberAllocationCalls).toBe(0);
    expect(fake.client.identityCard.create).toBeUndefined();
  });

  it("shows inactive Staff reasons while keeping exact designation scope", async () => {
    const fake = previewClient(
      { id: "batch", cardType: "STAFF", academicYear: "2026-27", scopeType: "STAFF_DESIGNATION", staffDesignation: "Teacher", status: "DRAFT" },
      { staff: [
        { id: "active", fullName: "Active Teacher", staffCode: "A", designation: "Teacher", status: "ACTIVE" },
        { id: "inactive", fullName: "Inactive Teacher", staffCode: "I", designation: "Teacher", status: "INACTIVE" }
      ] }
    );
    const result = await previewIdentityCardBatch(fake.client, "batch", "actor");
    expect(result.rows[0]).toMatchObject({ designation: "Teacher", eligible: true, reason: null });
    expect(result.rows[1]).toMatchObject({ designation: "Teacher", eligible: false, reason: "Staff status is INACTIVE" });
    expect(fake.numberAllocationCalls).toBe(0);
  });
});
