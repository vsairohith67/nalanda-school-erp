import { describe, expect, it, vi } from "vitest";
import {
  isPilotDatabaseUrl,
  resetPilotSampleData
} from "../lib/pilot-reset-sample-data";

function mockResetClient() {
  return {
    payment: {
      findMany: vi.fn().mockResolvedValue([{ id: "payment-1" }, { id: "payment-2" }]),
      deleteMany: vi.fn().mockResolvedValue({ count: 2 })
    },
    paymentAudit: {
      deleteMany: vi.fn().mockResolvedValue({ count: 3 })
    },
    receiptNote: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    student: {
      deleteMany: vi.fn().mockResolvedValue({ count: 4 })
    },
    importBatch: {
      deleteMany: vi.fn().mockResolvedValue({ count: 5 })
    }
  };
}

describe("pilot sample reset", () => {
  it("refuses normal database URLs", async () => {
    const client = mockResetClient();

    await expect(resetPilotSampleData(client, "file:./prisma/dev.db")).rejects.toThrow(
      "Refusing to reset sample pilot data"
    );
    expect(client.payment.findMany).not.toHaveBeenCalled();
  });

  it("allows copied pilot database URLs", () => {
    expect(isPilotDatabaseUrl("file:./pilot-data/pilot.db")).toBe(true);
    expect(isPilotDatabaseUrl("file:./prisma/nalanda-pilot.db")).toBe(true);
    expect(isPilotDatabaseUrl("file:./prisma/dev.db")).toBe(false);
  });

  it("targets only PILOT records and sample import batches", async () => {
    const client = mockResetClient();

    await expect(resetPilotSampleData(client, "file:./pilot-data/pilot.db")).resolves.toEqual({
      paymentAudits: 3,
      payments: 2,
      receiptNotes: 1,
      students: 4,
      importBatches: 5
    });
    expect(client.payment.findMany).toHaveBeenCalledWith({
      where: { receiptNo: { startsWith: "PILOT-" } },
      select: { id: true }
    });
    expect(client.paymentAudit.deleteMany).toHaveBeenCalledWith({
      where: { paymentId: { in: ["payment-1", "payment-2"] } }
    });
    expect(client.payment.deleteMany).toHaveBeenCalledWith({
      where: { receiptNo: { startsWith: "PILOT-" } }
    });
    expect(client.receiptNote.deleteMany).toHaveBeenCalledWith({
      where: { receiptNo: { startsWith: "PILOT-" } }
    });
    expect(client.student.deleteMany).toHaveBeenCalledWith({
      where: { admissionNo: { startsWith: "PILOT-" } }
    });
    expect(client.importBatch.deleteMany).toHaveBeenCalledWith({
      where: { fileName: { in: ["sample-students.csv", "sample-payments.csv"] } }
    });
  });
});
