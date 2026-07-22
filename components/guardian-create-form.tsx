"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GUARDIAN_RELATIONSHIPS } from "@/lib/guardian-constants";

export function GuardianCreateForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/guardians", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    const json = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(json.error || "Unable to create guardian");
      return;
    }
    router.push(`/guardians/${json.guardian.id}`);
    router.refresh();
  }

  return (
    <form className="card card-pad form-grid" onSubmit={submit}>
      <h3 className="full">Add Guardian</h3>
      <label className="wide">Guardian Name<input name="displayName" required /></label>
      <label>Primary Mobile<input name="primaryMobile" required /></label>
      <label>Alternate Mobile<input name="alternateMobile" /></label>
      <label>Email<input name="email" type="email" /></label>
      <label>
        Relationship
        <select name="relationship" defaultValue="Parent">
          {GUARDIAN_RELATIONSHIPS.map((relationship) => <option key={relationship}>{relationship}</option>)}
        </select>
      </label>
      <label>
        Status
        <select name="status" defaultValue="Active">
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </label>
      <label className="full">Notes<textarea name="notes" /></label>
      {message ? <div className="error full">{message}</div> : null}
      <div className="full"><button disabled={saving}>{saving ? "Creating..." : "Create Guardian"}</button></div>
    </form>
  );
}
