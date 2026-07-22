"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSecurityDialog } from "@/components/security-dialog-provider";

type Vendor = Record<string, string | number | null | undefined> & { id?: string };
const empty: Vendor = { vendorCode: "", name: "", contactPerson: "", mobile: "", alternateMobile: "", email: "", address: "", gstin: "", pan: "", bankName: "", accountLastFour: "", ifsc: "", paymentTermsDays: "", notes: "", status: "ACTIVE" };

export function VendorForm({ vendor, editable }: { vendor?: Vendor; editable: boolean }) {
  const router = useRouter(); const [form, setForm] = useState<Vendor>({ ...empty, ...vendor }); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const requestDialog = useSecurityDialog();
  const update = (key: string, value: string) => setForm((old) => ({ ...old, [key]: value }));
  async function save() { if (vendor?.id && String(form.status) !== String(vendor.status) && !await requestDialog({ title: "Change vendor status?", message: `Change vendor status from ${vendor.status} to ${form.status}? Existing expense history will be preserved.`, confirmLabel: "Change status" })) return; setBusy(true); setError(""); setMessage(""); try { const response = await fetch(vendor?.id ? `/api/vendors/${vendor.id}` : "/api/vendors", { method: vendor?.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to save vendor"); setMessage(vendor?.id ? "Vendor updated." : "Vendor created."); if (!vendor?.id) router.push(`/vendors/${data.vendor.id}`); else router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to save vendor"); } finally { setBusy(false); } }
  if (!editable) return null;
  return <section className="card card-pad"><div className="form-grid vendor-form-grid">
    <label>Vendor Code<input aria-label="Vendor Code" value={String(form.vendorCode ?? "")} onChange={(e) => update("vendorCode", e.target.value)} required /></label>
    <label>Vendor Name<input aria-label="Vendor Name" value={String(form.name ?? "")} onChange={(e) => update("name", e.target.value)} required /></label>
    <label>Contact Person<input aria-label="Contact Person" value={String(form.contactPerson ?? "")} onChange={(e) => update("contactPerson", e.target.value)} /></label>
    <label>Mobile<input aria-label="Mobile" value={String(form.mobile ?? "")} onChange={(e) => update("mobile", e.target.value)} /></label>
    <label>Alternate Mobile<input aria-label="Alternate Mobile" value={String(form.alternateMobile ?? "")} onChange={(e) => update("alternateMobile", e.target.value)} /></label>
    <label>Email<input aria-label="Email" type="email" value={String(form.email ?? "")} onChange={(e) => update("email", e.target.value)} /></label>
    <label>GSTIN <span className="muted-text">(format check only)</span><input aria-label="GSTIN" value={String(form.gstin ?? "")} onChange={(e) => update("gstin", e.target.value)} /></label>
    <label>PAN <span className="muted-text">(format check only)</span><input aria-label="PAN" value={String(form.pan ?? "")} onChange={(e) => update("pan", e.target.value)} /></label>
    <label>Bank Name<input aria-label="Bank Name" value={String(form.bankName ?? "")} onChange={(e) => update("bankName", e.target.value)} /></label>
    <label>Account Last Four<input aria-label="Account Last Four" inputMode="numeric" maxLength={4} value={String(form.accountLastFour ?? "")} onChange={(e) => update("accountLastFour", e.target.value)} /></label>
    <label>IFSC <span className="muted-text">(format check only)</span><input aria-label="IFSC" value={String(form.ifsc ?? "")} onChange={(e) => update("ifsc", e.target.value)} /></label>
    <label>Payment Terms (days)<input aria-label="Payment Terms Days" type="number" min="0" value={String(form.paymentTermsDays ?? "")} onChange={(e) => update("paymentTermsDays", e.target.value)} /></label>
    <label>Status<select aria-label="Vendor Status" value={String(form.status)} onChange={(e) => update("status", e.target.value)}><option>ACTIVE</option><option>INACTIVE</option><option>BLOCKED</option></select></label>
    <label className="wide">Address<textarea aria-label="Address" value={String(form.address ?? "")} onChange={(e) => update("address", e.target.value)} /></label>
    <label className="wide">Notes<textarea aria-label="Vendor Notes" value={String(form.notes ?? "")} onChange={(e) => update("notes", e.target.value)} /></label>
    <div className="full page-actions"><button type="button" disabled={busy} onClick={save}>{busy ? "Saving..." : vendor?.id ? "Save Vendor Changes" : "Create Vendor"}</button></div>
  </div>{message ? <div className="notice success" role="status">{message}</div> : null}{error ? <div className="notice danger" role="alert">{error}</div> : null}</section>;
}
