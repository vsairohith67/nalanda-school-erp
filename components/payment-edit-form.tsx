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
  canRestore
}: {
  payment: PaymentRecord;
  canRestore: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);

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

  async function cancel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    const response = await fetch(`/api/payments/${payment.id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason })
    });
    const data = await response.json();
    setBusy(false);
    setMessageType(response.ok ? "success" : "error");
    setMessage(response.ok ? "Payment cancelled and removed from collection totals" : data.error || "Unable to cancel payment");
    if (response.ok) router.refresh();
  }

  async function restore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    const response = await fetch(`/api/payments/${payment.id}/restore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason })
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
            <label>Date<input name="date" type="date" defaultValue={payment.date.slice(0, 10)} required /></label>
            <label>Receipt No<input name="receiptNo" defaultValue={payment.receiptNo} required /></label>
            <label>Admission No<input name="admissionNo" defaultValue={payment.admissionNo} required /></label>
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
          <form className="card card-pad form-grid" onSubmit={cancel}>
            <label className="wide">Required Cancellation Reason<input name="reason" placeholder="Duplicate entry, cancellation of receipt..." required /></label>
            <div style={{ alignSelf: "end" }}><button className="danger" disabled={busy}>Cancel Payment</button></div>
          </form>
        </>
      ) : (
        <section className="card card-pad">
          <p className="error">This payment is cancelled: {payment.cancellationReason}</p>
          {canRestore ? (
            <form className="form-grid" onSubmit={restore}>
              <label className="wide">Required Restore Reason<input name="reason" required /></label>
              <div style={{ alignSelf: "end" }}><button disabled={busy}>Restore Payment</button></div>
            </form>
          ) : null}
        </section>
      )}
      {message ? <div className={messageType === "error" ? "error" : "notice"} role="status">{message}</div> : null}
    </div>
  );
}
