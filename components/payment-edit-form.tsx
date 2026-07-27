"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FEE_TYPES, PAYMENT_MODES, RECEIVED_ACCOUNTS, TERM_HINTS } from "@/lib/constants";
import { displayDate, moneyExact } from "@/lib/format";

type PaymentRecord = {
  id: string;
  date: string;
  receiptNo: string;
  admissionNo: string;
  amountPaid: number;
  paymentMode: string;
  receivedAccount: string;
  transactionRefNo: string | null;
  feeType: string;
  termHint: string;
  remarks: string | null;
  isCancelled: boolean;
  cancellationReason: string | null;
};

type ReceiptSummary = {
  date: string;
  totalAmount: number;
  paymentModes: string;
  componentCount: number;
};

type PendingCorrection = {
  payload: Record<string, FormDataEntryValue>;
  financial: boolean;
};

export function PaymentEditForm({
  payment,
  canRestore,
  canCancel,
  canCorrect,
  receiptVersion,
  receiptSummary
}: {
  payment: PaymentRecord;
  canRestore: boolean;
  canCancel: boolean;
  canCorrect: boolean;
  receiptVersion: string;
  receiptSummary: ReceiptSummary;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [pendingCorrection, setPendingCorrection] = useState<PendingCorrection | null>(null);
  const [correctionKey, setCorrectionKey] = useState(() => newIdempotencyKey());
  const cancelTrigger = useRef<HTMLButtonElement>(null);
  const correctionTrigger = useRef<HTMLButtonElement>(null);
  const cancelDialogRef = useRef<HTMLElement>(null);
  const correctionDialogRef = useRef<HTMLElement>(null);

  useDialogFocus(cancelDialog, cancelDialogRef, cancelTrigger, () => {
    setCancelDialog(false);
    setCancelReason("");
  });
  useDialogFocus(Boolean(pendingCorrection), correctionDialogRef, correctionTrigger, () => {
    setPendingCorrection(null);
  });

  function reviewCorrection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const financial = [
      ["date", payment.date.slice(0, 10)],
      ["admissionNo", payment.admissionNo],
      ["amountPaid", String(payment.amountPaid)],
      ["paymentMode", payment.paymentMode],
      ["receivedAccount", payment.receivedAccount],
      ["feeType", payment.feeType],
      ["termHint", payment.termHint]
    ].some(([key, current]) => String(payload[key] ?? "") !== current);
    setPendingCorrection({ payload, financial });
  }

  async function correct() {
    if (!pendingCorrection) return;
    setBusy(true);
    const response = await fetch(`/api/payments/${payment.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...pendingCorrection.payload,
        expectedVersion: receiptVersion,
        idempotencyKey: correctionKey
      })
    });
    const data = await response.json();
    setBusy(false);
    setMessageType(response.ok ? "success" : "error");
    if (response.ok) {
      setMessage(
        data.replacementReceiptNo
          ? `Correction recorded. Receipt ${payment.receiptNo} remains cancelled history and replacement ${data.replacementReceiptNo} is active.`
          : "Non-financial correction recorded with an immutable audit version."
      );
      setPendingCorrection(null);
      setCorrectionKey(newIdempotencyKey());
      router.refresh();
    } else {
      setMessage(data.error || "Unable to correct final receipt");
    }
  }

  async function cancel() {
    setBusy(true);
    const response = await fetch(`/api/payments/${payment.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: cancelReason, expectedVersion: receiptVersion })
    });
    const data = await response.json();
    setBusy(false);
    setMessageType(response.ok ? "success" : "error");
    setMessage(
      response.ok
        ? "The entire receipt was cancelled, dues reopened, and collection totals reconciled."
        : data.error || "Unable to cancel receipt"
    );
    if (response.ok) {
      setCancelDialog(false);
      setCancelReason("");
      router.refresh();
    }
  }

  async function restore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    const response = await fetch(`/api/payments/${payment.id}/restore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason, expectedVersion: receiptVersion })
    });
    const data = await response.json();
    setBusy(false);
    setMessageType(response.ok ? "success" : "error");
    setMessage(response.ok ? "Payment restored and audit entry recorded" : data.error || "Unable to restore payment");
    if (response.ok) router.refresh();
  }

  return (
    <div className="grid finance-receipt-controls">
      {!payment.isCancelled ? (
        <>
          {canCorrect ? (
            <form className="card card-pad form-grid" onSubmit={reviewCorrection}>
              <h3 className="full">Governed final-receipt correction</h3>
              <p className="muted full">Non-financial changes create an immutable audit version. Any Student/admission, amount, date, mode, account, fee-type, term allocation, or derived academic-year change cancels this receipt and creates a linked replacement receipt.</p>
              <label>Date<input name="date" type="date" defaultValue={payment.date.slice(0, 10)} required /></label>
              <label>Receipt No<input name="receiptNo" defaultValue={payment.receiptNo} readOnly required aria-describedby="receipt-lock-help" /></label>
              <label>Admission No<input name="admissionNo" defaultValue={payment.admissionNo} required maxLength={80} aria-describedby="receipt-lock-help" /></label>
              <p id="receipt-lock-help" className="muted full">The original receipt number is immutable. Changing the admission number requires a valid Student Master record and creates a linked replacement receipt; the original Student and receipt remain in history.</p>
              <label>Amount Paid<input name="amountPaid" type="number" min="1" step="0.01" defaultValue={payment.amountPaid} required /></label>
              <label>Payment Mode<select name="paymentMode" defaultValue={payment.paymentMode}>{PAYMENT_MODES.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Received Account<select name="receivedAccount" defaultValue={payment.receivedAccount}>{RECEIVED_ACCOUNTS.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Transaction Ref No<input name="transactionRefNo" defaultValue={payment.transactionRefNo ?? ""} /></label>
              <label>Fee Type<select name="feeType" defaultValue={payment.feeType}>{FEE_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Term Hint<select name="termHint" defaultValue={payment.termHint}>{TERM_HINTS.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label className="wide">Remarks<input name="remarks" defaultValue={payment.remarks ?? ""} maxLength={500} /></label>
              <label className="full">Required correction reason<input name="reason" placeholder="Describe the verified correction" required minLength={3} maxLength={500} /></label>
              <div className="full"><button ref={correctionTrigger} disabled={busy}>Review governed correction</button></div>
            </form>
          ) : null}
          {canCancel ? (
            <section className="card card-pad">
              <h3>Receipt cancellation</h3>
              <p>Cancels all {receiptSummary.componentCount} component(s) under receipt {payment.receiptNo}. This is neither deletion nor refund; the receipt and immutable audit history remain preserved.</p>
              <button ref={cancelTrigger} type="button" className="danger" disabled={busy} onClick={() => setCancelDialog(true)}>Cancel entire receipt</button>
            </section>
          ) : null}
          {!canCorrect && !canCancel ? <section className="card card-pad"><p>You have read-only access to this final receipt.</p></section> : null}
        </>
      ) : (
        <section className="card card-pad">
          <p className="error">This receipt is cancelled: {payment.cancellationReason}</p>
          {canRestore ? (
            <form className="form-grid" onSubmit={restore}>
              <label className="wide">Required Restore Reason<input name="reason" required minLength={3} maxLength={500} /></label>
              <div style={{ alignSelf: "end" }}><button disabled={busy}>Restore Payment</button></div>
            </form>
          ) : null}
        </section>
      )}
      {message ? <div className={messageType === "error" ? "error" : "notice"} role={messageType === "error" ? "alert" : "status"}>{message}</div> : null}
      {pendingCorrection ? (
        <div className="confirmation-overlay" role="presentation">
          <section ref={correctionDialogRef} className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-correction-title" aria-describedby="payment-correction-description" tabIndex={-1}>
            <h3 id="payment-correction-title">Confirm governed correction</h3>
            <p id="payment-correction-description">
              {pendingCorrection.financial
                ? `This financial change will preserve receipt ${payment.receiptNo} as CANCELLED and issue a linked replacement. Dues, collection, Ledger, Cash Book, dashboard, print, and exports will use the replacement.`
                : `This non-financial change will preserve receipt ${payment.receiptNo} and append an immutable correction audit version.`}
            </p>
            <ReceiptFacts payment={payment} summary={receiptSummary} />
            <p><strong>History is never deleted, and this action is not a refund.</strong></p>
            <div className="page-actions">
              <button type="button" className="secondary" disabled={busy} onClick={() => setPendingCorrection(null)}>Go Back</button>
              <button type="button" disabled={busy} onClick={correct}>{busy ? "Recording safely..." : pendingCorrection.financial ? "Cancel and issue replacement" : "Record correction version"}</button>
            </div>
          </section>
        </div>
      ) : null}
      {cancelDialog ? (
        <div className="confirmation-overlay" role="presentation">
          <section ref={cancelDialogRef} className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-cancel-title" aria-describedby="payment-cancel-description" tabIndex={-1}>
            <h3 id="payment-cancel-title">Cancel receipt {payment.receiptNo}?</h3>
            <p id="payment-cancel-description">All split components will cancel in one transaction. Dues reopen, Daily Collection and Cash Book exclude the cancelled amount, and the original receipt remains visible as CANCELLED history.</p>
            <ReceiptFacts payment={payment} summary={receiptSummary} />
            <p><strong>This is neither deletion nor refund. Directors and Super Admins receive an in-app notification for an Accountant action.</strong></p>
            <label htmlFor="receipt-cancel-reason">Cancellation reason (required)</label>
            <textarea id="receipt-cancel-reason" autoFocus required rows={3} minLength={3} maxLength={500} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
            <div className="page-actions">
              <button type="button" className="secondary" disabled={busy} onClick={() => { setCancelDialog(false); setCancelReason(""); }}>Go Back</button>
              <button type="button" className="danger" disabled={busy || cancelReason.trim().length < 3} onClick={cancel}>{busy ? "Cancelling safely..." : "Cancel entire receipt"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ReceiptFacts({ payment, summary }: { payment: PaymentRecord; summary: ReceiptSummary }) {
  return (
    <dl className="receipt-confirmation-facts">
      <div><dt>Receipt</dt><dd>{payment.receiptNo}</dd></div>
      <div><dt>Amount</dt><dd>{moneyExact(summary.totalAmount)}</dd></div>
      <div><dt>Date</dt><dd>{displayDate(summary.date)}</dd></div>
      <div><dt>Payment modes</dt><dd>{summary.paymentModes || payment.paymentMode}</dd></div>
    </dl>
  );
}

function useDialogFocus(
  open: boolean,
  dialogRef: React.RefObject<HTMLElement | null>,
  triggerRef: React.RefObject<HTMLElement | null>,
  close: () => void
) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ));
    (focusable()[0] ?? dialog).focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", keydown);
    return () => {
      dialog.removeEventListener("keydown", keydown);
      triggerRef.current?.focus();
    };
  }, [open, dialogRef, triggerRef]);
}

function newIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `fin2b_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
