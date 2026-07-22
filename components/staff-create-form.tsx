"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { STAFF_STATUSES, STAFF_TYPES } from "@/lib/staff";

export function StaffCreateForm() {
  const router = useRouter(); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setSaving(true); setMessage("");
    const response = await fetch("/api/staff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    const data = await response.json(); setSaving(false);
    if (!response.ok) return setMessage(data.error || "Unable to add staff member");
    form.reset(); setMessage("Staff profile created."); router.refresh();
  }
  return <form className="card card-pad form-grid" onSubmit={submit}>
    <h3 className="full">Add Staff Profile</h3>
    <label>Staff Code<input name="staffCode" placeholder="Optional, for example T-014" /></label>
    <label>Full Name<input name="fullName" required /></label>
    <label>Staff Type<select name="staffType">{STAFF_TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
    <label>Designation<input name="designation" required placeholder="Teacher, Principal, Clerk..." /></label>
    <label>Department<input name="department" /></label><label>Primary Subject<input name="primarySubject" /></label>
    <label>Mobile<input name="mobile" inputMode="tel" /></label><label>Email<input name="email" type="email" /></label>
    <label>Status<select name="status">{STAFF_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
    <div className="full"><button disabled={saving}>{saving ? "Saving..." : "Create Staff Profile"}</button></div>
    {message ? <p className="full notice" role="status">{message}</p> : null}
  </form>;
}
