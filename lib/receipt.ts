export type ReceiptPaymentRow = {
  id: string;
  receiptNo: string;
  amountPaid: number;
  paymentMode: string;
  receivedAccount: string;
  transactionRefNo?: string | null;
  isCancelled?: boolean | null;
};

export type ReceiptStatus = "ACTIVE" | "PARTIALLY_CANCELLED" | "CANCELLED";

export function publicPaymentModeLabel(
  row: Pick<ReceiptPaymentRow, "paymentMode">,
  upiIndex?: number
) {
  if (row.paymentMode === "UPI") return upiIndex ? `UPI ${upiIndex}` : "UPI";
  if (["NEFT", "RTGS", "IMPS", "Cheque", "Other"].includes(row.paymentMode)) return row.paymentMode;
  if (row.paymentMode === "Bank Transfer") return "Bank Transfer";
  return "Cash";
}

export function receiptPublicRows<T extends ReceiptPaymentRow>(rows: T[]) {
  let upiCount = 0;
  return rows.map((row) => {
    const upiIndex = row.paymentMode === "UPI" ? ++upiCount : undefined;
    return {
      ...row,
      publicModeLabel: publicPaymentModeLabel(row, upiIndex)
    };
  });
}

export function groupReceiptPayments<T extends ReceiptPaymentRow>(rows: T[]) {
  if (!rows.length) throw new Error("Receipt has no payment rows");
  const activeRows = rows.filter((row) => !row.isCancelled);
  const status: ReceiptStatus =
    activeRows.length === 0
      ? "CANCELLED"
      : activeRows.length === rows.length
        ? "ACTIVE"
        : "PARTIALLY_CANCELLED";
  const rowsForTotals = activeRows.length ? activeRows : rows;
  const breakup = rowsForTotals.reduce<Record<string, number>>((acc, row) => {
    const key = `${row.paymentMode} / ${row.receivedAccount}`;
    acc[key] = (acc[key] ?? 0) + row.amountPaid;
    return acc;
  }, {});
  const publicBreakup = receiptPublicRows(rowsForTotals).reduce<Record<string, number>>((acc, row) => {
    acc[row.publicModeLabel] = (acc[row.publicModeLabel] ?? 0) + row.amountPaid;
    return acc;
  }, {});
  return {
    receiptNo: rows[0].receiptNo,
    status,
    totalAmount: rowsForTotals.reduce((sum, row) => sum + row.amountPaid, 0),
    originalTotal: rows.reduce((sum, row) => sum + row.amountPaid, 0),
    activeRows,
    rows,
    breakup,
    publicBreakup,
    isSplit: rows.length > 1
  };
}
