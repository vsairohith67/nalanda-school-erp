import { describe, expect, it } from "vitest";
import { parentIdentityCards, teacherIdentityCard } from "@/lib/id-card-portals";
import { exactIdentityCardLookup } from "@/lib/id-card-lookup";

const issuedCard = { id: "c", cardType: "STUDENT", studentId: "s1", staffMemberId: null, cardNumber: "QA18C-001", status: "ISSUED", validFrom: new Date("2026-06-01"), validUntil: new Date("2027-05-31"), currentVersionNumber: 1 };
const version = { id: "v", identityCardId: "c", versionNumber: 1, snapshotJson: JSON.stringify({ identity: { name: "QA18C Student", className: "10", section: "A" } }) };

describe("Prompt 18C Parent and Teacher isolation", () => {
  it("selects only children returned by the signed-in Guardian link", async () => {
    const client: any = {
      studentGuardian: { findMany: async ({ where }: any) => where.guardianId === "g1" ? [{ student: { id: "s1", admissionNo: "QA18C-S1", studentName: "Linked", className: "10", section: "A" } }] : [] },
      identityCard: { findFirst: async ({ where }: any) => where.studentId === "s1" ? issuedCard : null },
      identityCardVersion: { findUnique: async () => version }
    };
    const own = await parentIdentityCards(client, { id: "p", role: "PARENT", guardianId: "g1" }, "QA18C-S1");
    expect(own.selectedChild?.studentName).toBe("Linked"); expect(own.cards).toHaveLength(1);
    const unrelated = await parentIdentityCards(client, { id: "p", role: "PARENT", guardianId: "g1" }, "UNRELATED");
    expect(unrelated.selectedChild).toBeNull(); expect(unrelated.cards).toEqual([]);
    expect(JSON.stringify(own.cards)).not.toContain("recordedByUserId");
  });
  it("returns only the latest current Student card record while preserving its latest immutable version", async () => {
    let query: any;
    const latest = { ...issuedCard, id: "replacement", cardNumber: "QA18C-002", currentVersionNumber: 2 };
    const client: any = {
      studentGuardian: { findMany: async () => [{ student: { id: "s1", admissionNo: "QA18C-S1", studentName: "Linked", className: "10", section: "A" } }] },
      identityCard: { findFirst: async (value: any) => { query = value; return latest; } },
      identityCardVersion: { findUnique: async ({ where }: any) => ({ ...version, identityCardId: "replacement", versionNumber: where.identityCardId_versionNumber.versionNumber, snapshotJson: JSON.stringify({ identity: { name: "Linked" } }) }) }
    };
    const result = await parentIdentityCards(client, { id: "p", role: "PARENT", guardianId: "g1" });
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({ cardNumber: "QA18C-002", currentVersionNumber: 2 });
    expect(query.orderBy).toEqual([{ issuedAt: "desc" }, { createdAt: "desc" }]);
  });
  it("returns only the signed-in Teacher's linked StaffMember card and a safe unlinked state", async () => {
    const client: any = {
      staffMember: { findUnique: async ({ where }: any) => where.userId === "teacher" ? { id: "staff", fullName: "QA18C Teacher", staffCode: "QA18C-T", designation: "Teacher" } : null },
      identityCard: { findFirst: async ({ where }: any) => where.staffMemberId === "staff" ? [{ ...issuedCard, id: "sc", cardType: "STAFF", studentId: null, staffMemberId: "staff", cardNumber: "QA18C-ST-1" }][0] : null },
      identityCardVersion: { findUnique: async () => ({ ...version, identityCardId: "sc", snapshotJson: JSON.stringify({ identity: { name: "QA18C Teacher", designation: "Teacher" } }) }) }
    };
    expect((await teacherIdentityCard(client, { id: "teacher", role: "TEACHER" })).card?.cardNumber).toBe("QA18C-ST-1");
    expect(await teacherIdentityCard(client, { id: "peer", role: "TEACHER" })).toEqual({ linked: false, card: null });
  });
});

describe("Prompt 18C exact internal lookup", () => {
  it("uses exact normalized card number and returns only the safe allowlist", async () => {
    let received: string | undefined;
    const client: any = {
      identityCard: { findUnique: async ({ where }: any) => { received = where.cardNumber; return { ...issuedCard, student: { studentName: "QA18C Student" }, staffMember: null }; } },
      identityCardVersion: { findUnique: async () => version },
      identityCardEvent: { create: async () => ({}) }
    };
    const result = await exactIdentityCardLookup(client, " qa18c-001 ", "actor");
    expect(received).toBe("QA18C-001");
    expect(result).toMatchObject({ cardType: "STUDENT", cardNumber: "QA18C-001", name: "QA18C Student", className: "10", section: "A", photo: "PLACEHOLDER" });
    for (const forbidden of ["studentId","parent","contact","address","actor","finance"]) expect(result).not.toHaveProperty(forbidden);
  });
  it("does not fuzzy-match a missing card", async () => {
    const client: any = { identityCard: { findUnique: async () => null } };
    await expect(exactIdentityCardLookup(client, "QA18C")).resolves.toBeNull();
  });
});
