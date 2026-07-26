"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BANK_OTHER_PAYMENT_MODES, BANK_TRANSFER_PAYMENT_MODES, FEE_TYPES, TERM_HINTS } from "@/lib/constants";
import { isoDateInput, money } from "@/lib/format";

type StudentLookup = {
  admissionNo: string;
  studentName: string;
  className: string;
  section?: string | null;
  academicYear: string;
  status: string;
  feeAllocation: {
    totalCurrentYearPaid: number;
    totalPending: number;
    dueStatus: string;
  } | null;
};

type UpiTransactionRow = {
  id: string;
  amount: string;
  account: "Director Sir GPay" | "NPS Current Account UPI";
  reference: string;
};

function isBankTransferMode(mode: string) {
  return (BANK_TRANSFER_PAYMENT_MODES as readonly string[]).includes(mode);
}

function requiresReference(mode: string) {
  return mode === "UPI" || mode === "Cheque" || isBankTransferMode(mode);
}

function amountInputProps() {
  return {
    type: "text",
    inputMode: "decimal" as const,
    pattern: "^(?!0+(?:\\.0{1,2})?$)\\d+(\\.\\d{1,2})?$",
    title: "Enter an amount greater than zero, with up to two decimal places"
  };
}

function cleanAmountInput(value: string) {
  return value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

export function PaymentForm() {
  const router = useRouter();
  const [admissionNo, setAdmissionNo] = useState("");
  const [student, setStudent] = useState<StudentLookup | null>(null);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cashEnabled, setCashEnabled] = useState(true);
  const [cashAmount, setCashAmount] = useState("");
  const [upiEnabled, setUpiEnabled] = useState(false);
  const [upiRows, setUpiRows] = useState<UpiTransactionRow[]>([{
    id: "upi-1",
    amount: "",
    account: "Director Sir GPay",
    reference: ""
  }]);
  const [nextUpiRow, setNextUpiRow] = useState(2);
  const [otherEnabled, setOtherEnabled] = useState(false);
  const [otherAmount, setOtherAmount] = useState("");
  const [otherMode, setOtherMode] = useState<(typeof BANK_OTHER_PAYMENT_MODES)[number]>("Bank Transfer");
  const [otherAccount, setOtherAccount] = useState("NPS Bank Account");
  const [otherReference, setOtherReference] = useState("");
  const [allowMissingReference, setAllowMissingReference] = useState(false);

  const total =
    (cashEnabled ? Number(cashAmount) || 0 : 0) +
    (upiEnabled ? upiRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) : 0) +
    (otherEnabled ? Number(otherAmount) || 0 : 0);

  function updateUpiRow(id: string, patch: Partial<UpiTransactionRow>) {
    setUpiRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function addUpiRow() {
    const id = `upi-${nextUpiRow}`;
    setNextUpiRow((value) => value + 1);
    setUpiRows((rows) => [...rows, {
      id,
      amount: "",
      account: "Director Sir GPay",
      reference: ""
    }]);
  }

  function removeUpiRow(id: string) {
    setUpiRows((rows) => rows.length > 1 ? rows.filter((row) => row.id !== id) : rows);
  }

  useEffect(() => {
    if (!admissionNo.trim()) {
      setStudent(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/finance/students/lookup?admissionNo=${encodeURIComponent(admissionNo.trim())}`);
      if (response.ok) {
        setStudent(await response.json());
        setMessage("");
        setHasError(false);
      } else {
        setStudent(null);
        setMessage("Admission number not found");
        setHasError(true);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [admissionNo]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setHasError(false);
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    const components = [
      ...(cashEnabled ? [{
        amountPaid: Number(cashAmount),
        paymentMode: "Cash",
        receivedAccount: "Cash",
        transactionRefNo: null
      }] : []),
      ...(upiEnabled ? upiRows.map((row) => ({
        amountPaid: Number(row.amount),
        paymentMode: "UPI",
        receivedAccount: row.account,
        transactionRefNo: row.reference
      })) : []),
      ...(otherEnabled ? [{
        amountPaid: Number(otherAmount),
        paymentMode: otherMode,
        receivedAccount: otherAccount,
        transactionRefNo: otherReference
      }] : [])
    ];
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...fields,
        components,
        allowMissingTransactionRef: allowMissingReference
      })
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to save payment");
      setHasError(true);
      return;
    }
    router.push(`/ledger?q=${encodeURIComponent(String(fields.admissionNo))}`);
    router.refresh();
  }

  const missingRequiredReference =
    (upiEnabled && upiRows.some((row) => !row.reference.trim())) ||
    (otherEnabled && requiresReference(otherMode) && !otherReference.trim());

  return (
    <div className="grid">
      <form className="card card-pad payment-entry-form" onSubmit={onSubmit}>
        <div className="form-grid">
          <label>Date<input name="date" type="date" defaultValue={isoDateInput()} required /></label>
          <label>Receipt No<input name="receiptNo" required /></label>
          <label>Admission No<input name="admissionNo" value={admissionNo} onChange={(event) => setAdmissionNo(event.target.value)} required /></label>
          <label>Fee Type<select name="feeType">{FEE_TYPES.map((feeType) => <option key={feeType}>{feeType}</option>)}</select></label>
          <label>Term Hint<select name="termHint">{TERM_HINTS.map((term) => <option key={term}>{term}</option>)}</select></label>
        </div>

        {student ? (
          <section className="student-confirmation">
            <div className="section-title inline-section-title">
              <div>
                <h3>Auto-filled Student Details</h3>
                <p>Confirm the student before entering payment details.</p>
              </div>
            </div>
            <div className="grid four">
              <div><span className="badge">Student name</span><p>{student.studentName}</p></div>
              <div><span className="badge">Class/Section</span><p>{student.className}{student.section ? `-${student.section}` : ""}</p></div>
              <div><span className="badge">Academic year / status</span><p>{student.academicYear} · {student.status}</p></div>
              <div><span className="badge">Current-year due</span><p>{student.feeAllocation ? `${money(student.feeAllocation.totalPending)} · ${student.feeAllocation.dueStatus}` : "Fee structure not configured"}</p></div>
            </div>
          </section>
        ) : null}

        <section className="payment-components">
          <div className="section-title inline-section-title">
            <div>
              <h3>Payment Components</h3>
              <p>Select one or more components for this receipt.</p>
            </div>
            <strong className="payment-total">Total: {money(total)}</strong>
          </div>

          <div className="payment-component-grid">
            <div className={`payment-component ${cashEnabled ? "selected" : ""}`}>
              <label className="checkbox-label">
                <input type="checkbox" checked={cashEnabled} onChange={(event) => setCashEnabled(event.target.checked)} />
                Cash
              </label>
              {cashEnabled ? <label>Cash Amount<input {...amountInputProps()} value={cashAmount} onChange={(event) => setCashAmount(cleanAmountInput(event.target.value))} required /></label> : null}
            </div>

            <div className={`payment-component ${upiEnabled ? "selected" : ""}`}>
              <label className="checkbox-label">
                <input type="checkbox" checked={upiEnabled} onChange={(event) => setUpiEnabled(event.target.checked)} />
                UPI
              </label>
              {upiEnabled ? (
                <div className="upi-rows">
                  {upiRows.map((row, index) => (
                    <div className="upi-row" key={row.id}>
                      {upiRows.length > 1 ? (
                        <div className="upi-row-title">
                          <strong>UPI transaction {index + 1}</strong>
                          <button type="button" className="secondary small-button" onClick={() => removeUpiRow(row.id)}>
                            Remove UPI transaction {index + 1}
                          </button>
                        </div>
                      ) : null}
                      <label>UPI Amount<input {...amountInputProps()} value={row.amount} onChange={(event) => updateUpiRow(row.id, { amount: cleanAmountInput(event.target.value) })} required /></label>
                      <label>Received Account
                        <select value={row.account} onChange={(event) => updateUpiRow(row.id, { account: event.target.value as UpiTransactionRow["account"] })}>
                          <option>Director Sir GPay</option>
                          <option>NPS Current Account UPI</option>
                        </select>
                      </label>
                      <label>UPI Transaction / UTR<input value={row.reference} onChange={(event) => updateUpiRow(row.id, { reference: event.target.value })} placeholder="Required unless warning confirmed" required={!allowMissingReference} /></label>
                    </div>
                  ))}
                  <button type="button" className="secondary" onClick={addUpiRow}>
                    Add another UPI transaction
                  </button>
                </div>
              ) : null}
            </div>

            <div className={`payment-component ${otherEnabled ? "selected" : ""}`}>
              <label className="checkbox-label">
                <input type="checkbox" checked={otherEnabled} onChange={(event) => setOtherEnabled(event.target.checked)} />
                Bank / Other
              </label>
              {otherEnabled ? (
                <>
                  <label>Bank/Other Amount<input {...amountInputProps()} value={otherAmount} onChange={(event) => setOtherAmount(cleanAmountInput(event.target.value))} required /></label>
                  <label>Mode
                    <select value={otherMode} onChange={(event) => {
                      const mode = event.target.value as typeof otherMode;
                      setOtherMode(mode);
                      setOtherAccount(isBankTransferMode(mode) ? "NPS Bank Account" : "Other");
                    }}>
                      {BANK_OTHER_PAYMENT_MODES.map((mode) => <option key={mode}>{mode}</option>)}
                    </select>
                  </label>
                  <label>Received Account
                    <select value={otherAccount} onChange={(event) => setOtherAccount(event.target.value)}>
                      <option>NPS Bank Account</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <label>Transaction / Reference<input value={otherReference} onChange={(event) => setOtherReference(event.target.value)} placeholder={requiresReference(otherMode) ? "Required unless warning confirmed" : "Optional; add note in remarks if needed"} required={requiresReference(otherMode) && !allowMissingReference} /></label>
                </>
              ) : null}
            </div>
          </div>

          {missingRequiredReference ? (
            <label className="checkbox-label missing-reference-warning">
              <input type="checkbox" checked={allowMissingReference} onChange={(event) => setAllowMissingReference(event.target.checked)} />
              <span>
                Allow saving without UTR/reference and record an audit warning
                <small>Use only when the parent paid but the reference number is not available. This will be visible in audit records.</small>
              </span>
            </label>
          ) : null}
        </section>

        {message ? <div className={hasError ? "error" : "success-text"} role={hasError ? "alert" : "status"}>{message}</div> : null}
        <label className="full">Receipt-Level Remarks / Notes<textarea name="remarks" placeholder="Part payment, sibling note, parent promised balance, UTR correction, adjustment approval..." /></label>
        <div><button disabled={saving || !student || total <= 0}>{saving ? "Saving Receipt..." : "Save Payment Receipt"}</button></div>
      </form>

      <div className="notice">
        Cash, multiple UPI transactions, and Bank / Other entries are saved atomically as one receipt with safe internal component rows. The receipt audit shows it as a split payment when every component belongs to the same student.
      </div>
    </div>
  );
}
