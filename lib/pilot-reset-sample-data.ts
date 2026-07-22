import { PILOT_SAMPLE_IMPORT_FILES } from "@/lib/pilot-sample-constants";

type DeleteManyResult = { count: number };

type PilotResetClient = {
  payment: {
    findMany(args: { where: { receiptNo: { startsWith: string } }; select: { id: true } }): Promise<Array<{ id: string }>>;
    deleteMany(args: { where: { receiptNo: { startsWith: string } } }): Promise<DeleteManyResult>;
  };
  paymentAudit: {
    deleteMany(args: { where: { paymentId: { in: string[] } } }): Promise<DeleteManyResult>;
  };
  receiptNote: {
    deleteMany(args: { where: { receiptNo: { startsWith: string } } }): Promise<DeleteManyResult>;
  };
  student: {
    deleteMany(args: { where: { admissionNo: { startsWith: string } } }): Promise<DeleteManyResult>;
  };
  importBatch: {
    deleteMany(args: { where: { fileName: { in: string[] } } }): Promise<DeleteManyResult>;
  };
};

export type PilotResetSummary = {
  paymentAudits: number;
  payments: number;
  receiptNotes: number;
  students: number;
  importBatches: number;
};

export function isPilotDatabaseUrl(databaseUrl: string | undefined) {
  const value = String(databaseUrl ?? "").toLowerCase();
  return value.includes("pilot") || value.includes("pilot-data");
}

export async function resetPilotSampleData(
  client: PilotResetClient,
  databaseUrl: string | undefined
): Promise<PilotResetSummary> {
  if (!isPilotDatabaseUrl(databaseUrl)) {
    throw new Error(
      "DANGER: Refusing to reset sample pilot data because DATABASE_URL does not contain 'pilot' or 'pilot-data'. Point DATABASE_URL at a copied pilot database first."
    );
  }

  const pilotPayments = await client.payment.findMany({
    where: { receiptNo: { startsWith: "PILOT-" } },
    select: { id: true }
  });
  const paymentIds = pilotPayments.map((payment) => payment.id);

  const paymentAudits = paymentIds.length
    ? await client.paymentAudit.deleteMany({ where: { paymentId: { in: paymentIds } } })
    : { count: 0 };
  const payments = await client.payment.deleteMany({
    where: { receiptNo: { startsWith: "PILOT-" } }
  });
  const receiptNotes = await client.receiptNote.deleteMany({
    where: { receiptNo: { startsWith: "PILOT-" } }
  });
  const students = await client.student.deleteMany({
    where: { admissionNo: { startsWith: "PILOT-" } }
  });
  const importBatches = await client.importBatch.deleteMany({
    where: { fileName: { in: [...PILOT_SAMPLE_IMPORT_FILES] } }
  });

  return {
    paymentAudits: paymentAudits.count,
    payments: payments.count,
    receiptNotes: receiptNotes.count,
    students: students.count,
    importBatches: importBatches.count
  };
}
