"use client";

import { useState } from "react";
import {
  parseAndValidateBackup,
  type RestoreResult,
  type ValidatedBackup
} from "@/lib/restore";

const CONFIRMATION_TEXT = "RESTORE NALANDA DATA";

type Preview = {
  metadata: ValidatedBackup["metadata"];
  counts: {
    students: number;
    feeStructures: number;
    payments: number;
    paymentAudits: number;
    users: number;
    rolePermissions: number;
    notices: number;
    staffMembers: number;
    staffLeaveRequests: number;
    substituteAssignments: number;
    academicYearEnrollments: number;
    studentLifecycleEvents: number;
    vendors: number;
    expenseCategories: number;
    expenseDepartments: number;
    expenseRecords: number;
    expensePayments: number;
    expenseAudits: number;
    budgetPlans: number;
    budgetAllocations: number;
    budgetRevisions: number;
    receiptNotes: number;
    importBatches: number;
    goLiveChecklist: number;
    timetableTeachers: number;
    timetableSubjects: number;
    timetableClassSections: number;
    timetablePeriodTemplates: number;
    timetableAssignments: number;
    timetableTeacherUnavailability: number;
    timetableFixedPeriods: number;
    timetableDrafts: number;
    timetableEntries: number;
  };
  warnings: string[];
};

export function RestorePanel() {
  const [backup, setBackup] = useState<ValidatedBackup | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [working, setWorking] = useState(false);

  async function selectBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setBackup(null);
    setPreview(null);
    setResult(null);
    setConfirmation("");
    if (!file) return;

    setWorking(true);
    setMessage("");
    try {
      const parsed = parseAndValidateBackup(await file.text());
      const response = await fetch("/api/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "validate", backup: parsed })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Backup validation failed");
      setBackup(parsed);
      setPreview(json);
      setMessage("Backup validated. Review the counts before restoring.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup validation failed");
    } finally {
      setWorking(false);
    }
  }

  async function restoreBackup() {
    if (!backup || confirmation !== CONFIRMATION_TEXT) return;
    setWorking(true);
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restore", backup, confirmation })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Backup restore failed");
      setResult(json.result);
      setMessage("Backup restore completed. Review the result summary below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup restore failed");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="card card-pad">
      <div className="section-title">
        <div>
          <h3>Restore Backup</h3>
          <p>Upload a Nalanda full-backup JSON file and validate it before restoring.</p>
        </div>
        <a className="button secondary" href="/api/backup">Download Backup First</a>
      </div>

      <p className="notice">
        Restoring may replace current local database data. Download a backup before restore.
      </p>

      <div className="form-grid">
        <label className="wide">
          Backup JSON File
          <input type="file" accept=".json,application/json" onChange={selectBackup} disabled={working} />
        </label>
      </div>

      {preview ? (
        <>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Students</th>
                  <th>Fee Structures</th>
                  <th>Payments</th>
                  <th>Payment Audits</th>
                  <th>Users</th>
                  <th>Role Permissions</th>
                  <th>Notices</th>
                  <th>Staff Members</th>
                  <th>Staff Leave Requests</th>
                  <th>Substitute Assignments</th>
                  <th>Academic-year Enrollments</th>
                  <th>Lifecycle Events</th>
                  <th>Vendors</th><th>Expense Categories</th><th>Expense Departments</th><th>Expense Records</th><th>Expense Payments</th><th>Expense Audits</th><th>Budget Plans</th><th>Budget Allocations</th><th>Budget Revisions</th>
                  <th>Receipt Notes</th>
                  <th>Import Batches</th>
                  <th>Go-live Checklist</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{preview.counts.students}</td>
                  <td>{preview.counts.feeStructures}</td>
                  <td>{preview.counts.payments}</td>
                  <td>{preview.counts.paymentAudits}</td>
                  <td>{preview.counts.users}</td>
                  <td>{preview.counts.rolePermissions}</td>
                  <td>{preview.counts.notices}</td>
                  <td>{preview.counts.staffMembers}</td>
                  <td>{preview.counts.staffLeaveRequests}</td>
                  <td>{preview.counts.substituteAssignments}</td>
                  <td>{preview.counts.academicYearEnrollments}</td>
                  <td>{preview.counts.studentLifecycleEvents}</td>
                  <td>{preview.counts.vendors}</td><td>{preview.counts.expenseCategories}</td><td>{preview.counts.expenseDepartments}</td><td>{preview.counts.expenseRecords}</td><td>{preview.counts.expensePayments}</td><td>{preview.counts.expenseAudits}</td><td>{preview.counts.budgetPlans}</td><td>{preview.counts.budgetAllocations}</td><td>{preview.counts.budgetRevisions}</td>
                  <td>{preview.counts.receiptNotes}</td>
                  <td>{preview.counts.importBatches}</td>
                  <td>{preview.counts.goLiveChecklist}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Timetable Teachers</th>
                  <th>Subjects</th>
                  <th>Class Sections</th>
                  <th>Period Templates</th>
                  <th>Assignments</th>
                  <th>Unavailability</th>
                  <th>Fixed Periods</th>
                  <th>Drafts</th>
                  <th>Draft Entries</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{preview.counts.timetableTeachers}</td>
                  <td>{preview.counts.timetableSubjects}</td>
                  <td>{preview.counts.timetableClassSections}</td>
                  <td>{preview.counts.timetablePeriodTemplates}</td>
                  <td>{preview.counts.timetableAssignments}</td>
                  <td>{preview.counts.timetableTeacherUnavailability}</td>
                  <td>{preview.counts.timetableFixedPeriods}</td>
                  <td>{preview.counts.timetableDrafts}</td>
                  <td>{preview.counts.timetableEntries}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Backup generated {new Date(preview.metadata.generatedAt).toLocaleString()} by{" "}
            {preview.metadata.generatedBy}.
          </p>
          {preview.warnings.map((warning) => <p className="notice" key={warning}>{warning}</p>)}
          <div className="form-grid">
            <label className="wide">
              <span>Type <strong>{CONFIRMATION_TEXT}</strong> to confirm</span>
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </label>
            <div style={{ alignSelf: "end" }}>
              <button
                className="danger"
                onClick={restoreBackup}
                disabled={working || confirmation !== CONFIRMATION_TEXT}
              >
                {working ? "Restoring..." : "Restore Backup"}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {message ? <p className="notice" role="status">{message}</p> : null}
      {result ? <RestoreResultSummary result={result} /> : null}
    </section>
  );
}

function RestoreResultSummary({ result }: { result: RestoreResult }) {
  const rows = [
    ["Students", result.students],
    ["Fee structures", result.feeStructures],
    ["Payments", result.payments],
    ["Payment audits", result.paymentAudits],
    ["Users", result.users],
    ["Role permissions", result.rolePermissions],
    ["Notices", result.notices],
    ["Staff members", result.staffMembers],
    ["Staff leave requests", result.staffLeaveRequests],
    ["Substitute assignments", result.substituteAssignments],
    ["Academic-year enrollments", result.academicYearEnrollments],
    ["Student lifecycle events", result.studentLifecycleEvents],
    ["Vendors", result.vendors],
    ["Expense categories", result.expenseCategories],
    ["Expense departments", result.expenseDepartments],
    ["Expense records", result.expenseRecords],
    ["Expense payments", result.expensePayments],
    ["Expense audits", result.expenseAudits],
    ["Budget plans", result.budgetPlans],
    ["Budget allocations", result.budgetAllocations],
    ["Budget revisions", result.budgetRevisions],
    ["Receipt notes", result.receiptNotes],
    ["Import batches", result.importBatches],
    ["Go-live checklist", result.goLiveChecklist],
    ["Timetable teachers", result.timetableTeachers],
    ["Timetable subjects", result.timetableSubjects],
    ["Timetable class sections", result.timetableClassSections],
    ["Timetable period templates", result.timetablePeriodTemplates],
    ["Timetable assignments", result.timetableAssignments],
    ["Timetable unavailability", result.timetableTeacherUnavailability],
    ["Timetable fixed periods", result.timetableFixedPeriods]
    ,["Timetable drafts", result.timetableDrafts]
    ,["Timetable entries", result.timetableEntries]
  ] as const;
  const errors = rows.flatMap(([label, item]) => item.errors.map((error) => `${label}: ${error}`));
  const warnings = [
    ...result.warnings,
    ...rows.flatMap(([label, item]) => item.warnings.map((warning) => `${label}: ${warning}`))
  ];

  return (
    <div style={{ marginTop: 16 }}>
      <h3>Restore Result</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Entity</th><th>Created</th><th>Updated</th><th>Skipped</th><th>Warnings</th><th>Errors</th></tr></thead>
          <tbody>
            {rows.map(([label, item]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{item.created}</td>
                <td>{item.updated}</td>
                <td>{item.skipped}</td>
                <td>{item.warnings.length}</td>
                <td>{item.errors.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {warnings.length ? (
        <div className="notice"><strong>Warnings</strong><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>
      ) : null}
      {errors.length ? (
        <div className="error"><strong>Errors</strong><ul>{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>
      ) : null}
    </div>
  );
}
