"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GUARDIAN_RELATIONSHIPS } from "@/lib/guardian-constants";

type GuardianDetailValue = {
  id: string;
  displayName: string;
  primaryMobile: string;
  alternateMobile: string | null;
  email: string | null;
  relationship: string;
  status: string;
  notes: string | null;
  users: Array<{
    id: string;
    name: string;
    username: string;
    email: string | null;
    role: string;
    isActive: boolean;
  }>;
  students: Array<{
    studentId: string;
    relationshipToStudent: string;
    isPrimaryContact: boolean;
    canViewFees: boolean;
    canReceiveReminders: boolean;
    student: {
      id: string;
      admissionNo: string;
      studentName: string;
      className: string;
      section: string | null;
      status: string;
    };
  }>;
};

export function GuardianDetail({ guardian, canManage }: { guardian: GuardianDetailValue; canManage: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function request(path: string, payload: Record<string, unknown>, method = "POST") {
    setSaving(true);
    setMessage("");
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(json.error || "Unable to save guardian changes");
      return false;
    }
    setMessage("Saved.");
    router.refresh();
    return true;
  }

  async function updateGuardian(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await request(`/api/guardians/${guardian.id}`, Object.fromEntries(new FormData(event.currentTarget).entries()), "PUT");
  }

  async function linkStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request(`/api/guardians/${guardian.id}/students`, {
      admissionNo: form.get("admissionNo"),
      relationshipToStudent: form.get("relationshipToStudent"),
      isPrimaryContact: form.get("isPrimaryContact") === "on",
      canViewFees: form.get("canViewFees") === "on",
      canReceiveReminders: form.get("canReceiveReminders") === "on"
    });
  }

  async function createParentLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request(`/api/guardians/${guardian.id}/parent-user`, {
      username: form.get("username"),
      email: form.get("email"),
      password: form.get("password")
    });
  }

  async function linkExistingLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await request(`/api/guardians/${guardian.id}/parent-user`, {
      action: "link-existing",
      username: form.get("username")
    });
  }

  const parentUser = guardian.users.find((user) => user.role === "PARENT");

  return (
    <>
      <section className="notice">
        Parent logins open the read-only parent portal for linked children and cannot access payment entry, ledgers, users, roles, or guardian admin pages.
      </section>
      <div className="grid two">
        <form className="card card-pad form-grid" onSubmit={updateGuardian}>
          <h3 className="full">Guardian Details</h3>
          <label className="wide">Guardian Name<input name="displayName" defaultValue={guardian.displayName} required disabled={!canManage} /></label>
          <label>Primary Mobile<input name="primaryMobile" defaultValue={guardian.primaryMobile} required disabled={!canManage} /></label>
          <label>Alternate Mobile<input name="alternateMobile" defaultValue={guardian.alternateMobile ?? ""} disabled={!canManage} /></label>
          <label>Email<input name="email" type="email" defaultValue={guardian.email ?? ""} disabled={!canManage} /></label>
          <label>
            Relationship
            <select name="relationship" defaultValue={guardian.relationship} disabled={!canManage}>
              {GUARDIAN_RELATIONSHIPS.map((relationship) => <option key={relationship}>{relationship}</option>)}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={guardian.status} disabled={!canManage}>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
          <label className="full">Notes<textarea name="notes" defaultValue={guardian.notes ?? ""} disabled={!canManage} /></label>
          {canManage ? <div className="full"><button disabled={saving}>Save Guardian</button></div> : null}
        </form>

        <section className="card card-pad">
          <h3>Parent Login Account</h3>
          {parentUser ? (
            <p>
              <span className={`badge ${parentUser.isActive ? "success" : "danger"}`}>
                {parentUser.isActive ? "Active" : "Inactive"}
              </span>{" "}
              {parentUser.username}
            </p>
          ) : canManage ? (
            <>
              <p className="notice">
                No login is created automatically. Enter a reviewed username and temporary password only when the school chooses to prepare this parent account.
              </p>
              <form className="form-grid compact-form" onSubmit={createParentLogin}>
                <label>Username<input name="username" defaultValue={suggestUsername(guardian)} required /></label>
                <label>Email<input name="email" type="email" defaultValue={guardian.email ?? ""} /></label>
                <label className="wide">Temporary Password<input name="password" type="password" minLength={12} maxLength={128} required /></label>
                <div className="full"><button disabled={saving}>Create Parent Login</button></div>
              </form>
              <form className="form-grid compact-form" onSubmit={linkExistingLogin}>
                <label className="wide">Existing Parent Username<input name="username" /></label>
                <div className="full"><button className="secondary" disabled={saving}>Link Existing Parent User</button></div>
              </form>
            </>
          ) : (
            <p className="muted-text">No parent login linked.</p>
          )}
        </section>
      </div>

      {message ? <p className={message === "Saved." ? "notice" : "error"} role="status">{message}</p> : null}

      <section className="card">
        <div className="section-title">
          <div>
            <h3>Linked Students</h3>
            <p>One guardian can be linked to multiple children for sibling grouping.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Adm No</th><th>Student</th><th>Class</th><th>Relationship</th>
                <th>Primary</th><th>Fees</th><th>Reminders</th><th></th>
              </tr>
            </thead>
            <tbody>
              {guardian.students.map((link) => (
                <tr key={link.studentId}>
                  <td>{link.student.admissionNo}</td>
                  <td>{link.student.studentName}</td>
                  <td>{link.student.className}{link.student.section ? `-${link.student.section}` : ""}</td>
                  <td>{link.relationshipToStudent}</td>
                  <td>{link.isPrimaryContact ? "Yes" : "No"}</td>
                  <td>{link.canViewFees ? "Yes" : "No"}</td>
                  <td>{link.canReceiveReminders ? "Yes" : "No"}</td>
                  <td>
                    {canManage ? (
                      <button
                        className="danger"
                        type="button"
                        disabled={saving}
                        onClick={() => request(`/api/guardians/${guardian.id}/students`, { studentId: link.studentId }, "DELETE")}
                      >
                        Remove
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!guardian.students.length ? <tr><td colSpan={8}>No students linked yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {canManage ? (
        <form className="card card-pad form-grid" onSubmit={linkStudent}>
          <h3 className="full">Add Student Link</h3>
          <label>Admission No<input name="admissionNo" required /></label>
          <label>
            Relationship
            <select name="relationshipToStudent" defaultValue={guardian.relationship}>
              {GUARDIAN_RELATIONSHIPS.map((relationship) => <option key={relationship}>{relationship}</option>)}
            </select>
          </label>
          <label className="review-checkbox">
            <input name="isPrimaryContact" type="checkbox" />
            <span>Primary contact for this student</span>
          </label>
          <label className="review-checkbox">
            <input name="canViewFees" type="checkbox" defaultChecked />
            <span>Can view fees in the read-only parent portal</span>
          </label>
          <label className="review-checkbox">
            <input name="canReceiveReminders" type="checkbox" defaultChecked />
            <span>Can receive reminders later when messaging is added</span>
          </label>
          <div className="full"><button disabled={saving}>Add Student Link</button></div>
        </form>
      ) : null}
    </>
  );
}

function suggestUsername(guardian: GuardianDetailValue) {
  return guardian.primaryMobile ? `parent${guardian.primaryMobile}` : "";
}
