"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FEE_TYPES, PAYMENT_MODES, RECEIVED_ACCOUNTS, TERM_HINTS } from "@/lib/constants";

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

export function PaymentEditForm({
  payment,
  canRestore,
  canCancel,
  receiptVersion
}: {
  payment: PaymentRecord;
  canRestore: boolean;
  canCancel: boolean;
  receiptVersion: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch(`/api/payments/${payment.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    setBusy(false);
    setMessageType(response.ok ? "success" : "error");
    setMessage(response.ok ? "Payment updated and audit entry recorded" : data.error || "Unable to update payment");
    if (response.ok) router.refresh();
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
    setMessage(response.ok ? "The entire receipt was cancelled and removed from collection totals" : data.error || "Unable to cancel receipt");
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
    <div className="grid">
      {!payment.isCancelled ? (
        <>
          <form className="card card-pad form-grid" onSubmit={update}>
            <input type="hidden" name="expectedVersion" value={receiptVersion} />
            <label>Date<input name="date" type="date" defaultValue={payment.date.slice(0, 10)} required /></label>
            <label>Receipt No<input name="receiptNo" defaultValue={payment.receiptNo} readOnly required aria-describedby="receipt-lock-help" /></label>
            <label>Admission No<input name="admissionNo" defaultValue={payment.admissionNo} readOnly required aria-describedby="receipt-lock-help" /></label>
            <p id="receipt-lock-help" className="muted full">Receipt and admission numbers are locked so a correction cannot split or reassign receipt history.</p>
            <label>Amount Paid<input name="amountPaid" type="number" min="1" step="0.01" defaultValue={payment.amountPaid} required /></label>
            <label>Payment Mode<select name="paymentMode" defaultValue={payment.paymentMode}>{PAYMENT_MODES.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Received Account<select name="receivedAccount" defaultValue={payment.receivedAccount}>{RECEIVED_ACCOUNTS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Transaction Ref No<input name="transactionRefNo" defaultValue={payment.transactionRefNo ?? ""} /></label>
            <label>Fee Type<select name="feeType" defaultValue={payment.feeType}>{FEE_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Term Hint<select name="termHint" defaultValue={payment.termHint}>{TERM_HINTS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="wide">Remarks<input name="remarks" defaultValue={payment.remarks ?? ""} /></label>
            <label className="full">Required Edit Reason<input name="reason" placeholder="Wrong amount, receipt correction, payment mode correction..." required /></label>
            <div className="full"><button disabled={busy}>Save Audited Changes</button></div>
          </form>
          {canCancel ? (
            <section className="card card-pad">
              <h3>Receipt cancellation</h3>
              <p>Cancels every component under receipt {payment.receiptNo}; no row or audit history is deleted.</p>
              <button type="button" className="danger" disabled={busy} onClick={() => setCancelDialog(true)}>Cancel entire receipt</button>
            </section>
          ) : null}
        </>
      ) : (
        <section className="card card-pad">
          <p className="error">This payment is cancelled: {payment.cancellationReason}</p>
          {canRestore ? (
            <form className="form-grid" onSubmit={restore}>
              <label className="wide">Required Restore Reason<input name="reason" required minLength={3} maxLength={500} /></label>
              <div style={{ alignSelf: "end" }}><button disabled={busy}>Restore Payment</button></div>
            </form>
          ) : null}
        </section>
      )}
      {message ? <div className={messageType === "error" ? "error" : "notice"} role="status">{message}</div> : null}
      {cancelDialog ? (
        <div className="confirmation-overlay" role="presentation">
          <section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-cancel-title" aria-describedby="payment-cancel-description">
            <h3 id="payment-cancel-title">Cancel receipt {payment.receiptNo}?</h3>
            <p id="payment-cancel-description">All split components will be cancelled in one transaction. Dues reopen and the receipt stays available only as visibly cancelled history.</p>
            <label>Cancellation reason (required)
              <textarea autoFocus rows={3} minLength={3} maxLength={500} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
            </label>
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
