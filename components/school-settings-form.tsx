"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SchoolSettingsValue } from "@/lib/school-settings";

export function SchoolSettingsForm({ settings }: { settings: SchoolSettingsValue }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const formData = new FormData(event.currentTarget);
    const body = {
      ...Object.fromEntries(formData.entries()),
      showSchoolPhone: formData.has("showSchoolPhone"),
      showSchoolAddress: formData.has("showSchoolAddress")
    };
    try {
      const response = await fetch("/api/school-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to save settings");
      setMessage("School and receipt settings saved");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card card-pad form-grid" onSubmit={save}>
      <h3 className="full form-heading">School Profile</h3>
      <label className="wide">School Name<input name="schoolName" defaultValue={settings.schoolName} required /></label>
      <label className="wide">Address Line<input name="addressLine1" defaultValue={settings.addressLine1} required /></label>
      <label>City<input name="city" defaultValue={settings.city} required /></label>
      <label>Phone<input name="phone" defaultValue={settings.phone} required /></label>
      <label>Academic Year<input name="academicYear" defaultValue={settings.academicYear} required /></label>
      <label>Default Currency<select name="defaultCurrency" defaultValue={settings.defaultCurrency}><option value="INR">INR</option></select></label>
      <label>Receipt Prefix<input name="receiptPrefix" defaultValue={settings.receiptPrefix ?? ""} placeholder="Optional" /></label>
      <label className="wide">WhatsApp Reminder Footer<input name="whatsappReminderFooter" defaultValue={settings.whatsappReminderFooter} required /></label>
      <label className="wide">Logo Path<input name="logoPath" defaultValue={settings.logoPath} required /></label>

      <h3 className="full form-heading">Receipt / Print Settings</h3>
      <label className="wide">Receipt Title<input name="receiptTitle" defaultValue={settings.receiptTitle} required /></label>
      <label>Default Print Size<select name="defaultPrintSize" defaultValue={settings.defaultPrintSize}><option value="A5">A5</option><option value="A4">A4</option></select></label>
      <label>Signature Label<select name="signatureLabel" defaultValue={settings.signatureLabel}><option>Receiver Signature</option><option>Accountant Signature</option></select></label>
      <label className="checkbox-label"><input name="showSchoolPhone" type="checkbox" defaultChecked={settings.showSchoolPhone} /> Show school phone</label>
      <label className="checkbox-label"><input name="showSchoolAddress" type="checkbox" defaultChecked={settings.showSchoolAddress} /> Show school address</label>
      <div className="full page-actions"><button disabled={saving}>{saving ? "Saving..." : "Save School Settings"}</button></div>
      {message ? <div className="full success-text" role="status">{message}</div> : null}
      {error ? <div className="full error" role="alert">{error}</div> : null}
    </form>
  );
}
