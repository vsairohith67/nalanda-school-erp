"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { displayDate, money } from "@/lib/format";
import { StatusBadge } from "@/components/ui";
import Link from "next/link";
import { ReminderActions } from "@/components/reminder-actions";

type LedgerData = {
  student: any;
  fee: any;
  payments: any[];
  allocation: any;
  whatsappMessage: string;
  shortMessage: string;
  detailedMessage: string;
  whatsappLink: string | null;
};

export function LedgerSearch() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [data, setData] = useState<LedgerData | null>(null);
  const [message, setMessage] = useState("");

  async function load(search = q) {
    if (!search.trim()) {
      setData(null);
      setMessage("Enter an admission number, student name, or phone number.");
      return;
    }
    setMessage("Loading ledger...");
    const response = await fetch(`/api/ledger?q=${encodeURIComponent(search.trim())}`);
    const json = await response.json();
    if (!response.ok) {
      setData(null);
      setMessage(json.error || "Not found");
      return;
    }
    setData(json);
    setMessage("");
    router.replace(`/ledger?q=${encodeURIComponent(search.trim())}`);
  }

  useEffect(() => {
    const initial = sp.get("q");
    if (initial) load(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid">
      <form className="card card-pad filters" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <label>Search Admission No, Student Name, Phone<input value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <button>Search</button>
      </form>
      {message ? <div className="error">{message}</div> : null}
      {data ? (
        <>
          <section className="card card-pad">
            <div className="grid four">
              <div><span className="badge">Student</span><p>{data.student.studentName}</p></div>
              <div><span className="badge">Class</span><p>{data.student.className}{data.student.section ? `-${data.student.section}` : ""}</p></div>
              <div><span className="badge">Parent</span><p>{data.student.fatherName}</p></div>
              <div><span className="badge">Contact</span><p>{data.student.phone1}{data.student.phone2 ? ` / ${data.student.phone2}` : ""}</p></div>
            </div>
          </section>
          <div className="grid four">
            <div className="card stat"><span>Annual Fee</span><strong>{money(data.allocation.annualFee)}</strong></div>
            <div className="card stat"><span>Discount</span><strong>{data.allocation.effectiveDiscountPercent}%</strong></div>
            <div className="card stat"><span>Current Paid</span><strong>{money(data.allocation.totalCurrentYearPaid)}</strong></div>
            <div className="card stat"><span>Total Pending</span><strong>{money(data.allocation.totalPending)}</strong></div>
          </div>
          <section className="card">
            <div className="section-title"><h3>Term-wise Allocation</h3><StatusBadge status={data.allocation.dueStatus} /></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Term</th><th>Due Month</th><th>Paid</th><th>Due</th></tr></thead>
                <tbody>{data.allocation.terms.map((term: any) => <tr key={term.term}><td>Term {term.term}</td><td>{term.dueMonth}</td><td>{money(term.paid)}</td><td>{money(term.due)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <div className="section-title"><h3>Payments</h3></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Receipt</th><th>Amount</th><th>Mode</th><th>Account</th><th>Ref</th><th>Fee Type</th><th>Remarks</th><th></th></tr></thead>
                <tbody>
                  {data.payments.map((p) => <tr key={p.id} className={p.isCancelled ? "cancelled-row" : ""}><td>{displayDate(p.date)}</td><td>{p.receiptNo}</td><td>{money(p.amountPaid)}</td><td>{p.paymentMode}</td><td>{p.receivedAccount}</td><td>{p.transactionRefNo || "-"}</td><td>{p.feeType}</td><td>{p.isCancelled ? `Cancelled: ${p.cancellationReason}` : p.remarks}</td><td><Link href={`/receipts/${encodeURIComponent(p.receiptNo)}/print`} target="_blank">Print Receipt</Link></td></tr>)}
                  {!data.payments.length ? <tr><td colSpan={9}>No payment history found.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <div className="section-title"><h3>Payment Audit History</h3></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Receipt</th><th>Action</th><th>Changed By</th><th>Reason</th><th>Timestamp</th></tr></thead>
                <tbody>
                  {data.payments.flatMap((payment) =>
                    (payment.audits ?? []).map((audit: any) => (
                      <tr key={audit.id}>
                        <td>{payment.receiptNo}</td>
                        <td>{audit.action}</td>
                        <td>{audit.changedByName}</td>
                        <td>{audit.reason || "-"}</td>
                        <td>{audit.createdAt.slice(0, 19).replace("T", " ")}</td>
                      </tr>
                    ))
                  )}
                  {!data.payments.some((payment) => (payment.audits ?? []).length) ? <tr><td colSpan={5}>No payment audit entries found.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card card-pad">
            <div className="section-title inline-section-title">
              <h3>Parent Communication</h3>
              <Link className="button secondary" href={`/ledger/print?q=${encodeURIComponent(data.student.admissionNo)}`} target="_blank">Print Ledger</Link>
            </div>
            <label>Short WhatsApp Message<textarea readOnly value={data.shortMessage} /></label>
            <label>Detailed WhatsApp Message<textarea readOnly value={data.detailedMessage} /></label>
            <ReminderActions shortMessage={data.shortMessage} detailedMessage={data.detailedMessage} whatsappLink={data.whatsappLink} />
          </section>
        </>
      ) : null}
    </div>
  );
}
