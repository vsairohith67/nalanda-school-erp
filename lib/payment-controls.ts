import { BANK_TRANSFER_PAYMENT_MODES, PAYMENT_MODES } from "@/lib/constants";

export const MAX_PAYMENT_COMPONENTS = 10;

export type PaymentControlLike = {
  amountPaid: number;
  isCancelled?: boolean | null;
  deletedAt?: Date | string | null;
};

export function isCountablePayment(payment: PaymentControlLike) {
  return !payment.deletedAt && !payment.isCancelled && payment.amountPaid > 0;
}

export function sumCountablePayments(payments: PaymentControlLike[]) {
  return payments.filter(isCountablePayment).reduce((sum, payment) => sum + payment.amountPaid, 0);
}

export function requiresTransactionReference(paymentMode: string) {
  return paymentMode === "UPI" || paymentMode === "Cheque" || (BANK_TRANSFER_PAYMENT_MODES as readonly string[]).includes(paymentMode);
}

export function sumPendingAmounts(rows: Array<{ totalPending: number } | null>) {
  return rows.reduce((sum, row) => sum + (row?.totalPending ?? 0), 0);
}

export type PaymentComponent = {
  amountPaid: number;
  paymentMode: (typeof PAYMENT_MODES)[number];
  receivedAccount: string;
  transactionRefNo: string | null;
};

export function paymentComponentTotal(components: Array<Pick<PaymentComponent, "amountPaid">>) {
  return components.reduce((sum, component) => sum + Math.max(0, Number(component.amountPaid) || 0), 0);
}

export function normalizePaymentComponents(body: Record<string, unknown>) {
  if (!Array.isArray(body.components)) return null;
  if (body.components.length > MAX_PAYMENT_COMPONENTS) {
    throw new Error(`A receipt can contain at most ${MAX_PAYMENT_COMPONENTS} payment components`);
  }
  const allowMissingTransactionRef = body.allowMissingTransactionRef === true;
  const components = body.components.map((value) => {
    const component = (value ?? {}) as Record<string, unknown>;
    const amountPaid = Number(component.amountPaid);
    const paymentMode = String(component.paymentMode ?? "");
    const receivedAccount = String(component.receivedAccount ?? "");
    const transactionRefNo = String(component.transactionRefNo ?? "").trim() || null;
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      throw new Error(`Enter a positive ${paymentMode || "payment"} amount`);
    }
    if (requiresTransactionReference(paymentMode) && !transactionRefNo && !allowMissingTransactionRef) {
      throw new Error(`${paymentMode} transaction / UTR is required, or confirm that it should be saved with an audit warning`);
    }
    return { amountPaid, paymentMode, receivedAccount, transactionRefNo };
  });
  if (!components.length) throw new Error("Select at least one payment component");
  return components;
}

export function assertReceiptStudentMatch(
  existingAdmissionNo: string | null | undefined,
  incomingAdmissionNo: string
) {
  if (existingAdmissionNo && existingAdmissionNo !== incomingAdmissionNo) {
    throw new Error("This receipt number is already used for a different student");
  }
}

type ReceiptStudentClient = {
  payment: {
    findFirst(args: {
      where: {
        receiptNo: string;
        deletedAt: null;
        admissionNo: { not: string };
        id?: { not: string };
      };
      select: { admissionNo: true };
    }): Promise<{ admissionNo: string } | null>;
  };
};

export async function assertReceiptStudentMatchInDatabase(
  client: ReceiptStudentClient,
  input: {
    receiptNo: string;
    admissionNo: string;
    excludePaymentId?: string;
  }
) {
  const existing = await client.payment.findFirst({
    where: {
      receiptNo: input.receiptNo,
      deletedAt: null,
      admissionNo: { not: input.admissionNo },
      ...(input.excludePaymentId ? { id: { not: input.excludePaymentId } } : {})
    },
    select: { admissionNo: true }
  });
  if (existing) assertReceiptStudentMatch(existing.admissionNo, input.admissionNo);
}
