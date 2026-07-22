"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildFeeStructureEditorRows,
  type FeeStructureEditorRow
} from "@/lib/fee-structures";
import { money } from "@/lib/format";
import { dueMonthsForClass } from "@/lib/constants";

type ExistingFeeStructure = {
  id?: string;
  academicYear: string;
  className: string;
  termAmount: number;
  term1Month: string;
  term2Month: string;
  term3Month: string;
  term4Month: string;
};

type EditableRow = FeeStructureEditorRow & {
  status: "Saved" | "Existing" | "New" | "Unsaved";
};

export function FeeStructureEditor({
  rows,
  defaultAcademicYear
}: {
  rows: ExistingFeeStructure[];
  defaultAcademicYear: string;
}) {
  const router = useRouter();
  const academicYears = useMemo(
    () => Array.from(new Set([defaultAcademicYear, ...rows.map((row) => row.academicYear)])),
    [defaultAcademicYear, rows]
  );
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);
  const [editableRows, setEditableRows] = useState<EditableRow[]>(() => editorRows(rows, defaultAcademicYear));
  const [advancedOverride, setAdvancedOverride] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [saving, setSaving] = useState(false);

  function changeAcademicYear(value: string) {
    setAcademicYear(value);
    setEditableRows(editorRows(rows, value));
    setMessage("");
  }

  function updateRow(className: string, field: keyof FeeStructureEditorRow, value: string) {
    setEditableRows((current) => current.map((row) => row.className === className
      ? {
          ...row,
          [field]: field === "termAmount" ? Number(value) : value,
          status: "Unsaved"
        }
      : row));
  }

  function toggleAdvancedOverride(enabled: boolean) {
    setAdvancedOverride(enabled);
    if (!enabled) {
      setEditableRows((current) => current.map((row) => {
        const months = dueMonthsForClass(row.className);
        return {
          ...row,
          term1Month: months[0],
          term2Month: months[1],
          term3Month: months[2],
          term4Month: months[3],
          status: row.status === "Saved" ? "Saved" : "Unsaved"
        };
      }));
    }
  }

  async function saveAll() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/fee-structures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          academicYear,
          advancedOverride,
          rows: editableRows
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to save fee structures");
      setEditableRows((current) => current.map((row) => ({ ...row, exists: true, status: "Saved" })));
      setMessageType("success");
      setMessage(`Saved all ${editableRows.length} fee structures for ${academicYear}.`);
      router.refresh();
    } catch (error) {
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Unable to save fee structures");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card fee-structure-editor">
      <div className="section-title">
        <div>
          <h3>Class Fee Structures</h3>
          <p>Term months are fixed automatically. Yearly amount is term amount × 4.</p>
        </div>
        <div className="fee-structure-toolbar">
          <label>Academic Year
            <select value={academicYear} onChange={(event) => changeAcademicYear(event.target.value)}>
              {academicYears.map((year) => <option key={year}>{year}</option>)}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={advancedOverride}
              onChange={(event) => toggleAdvancedOverride(event.target.checked)}
            />
            Advanced month override
          </label>
        </div>
      </div>
      <div className="table-wrap fee-structure-table">
        <table>
          <thead>
            <tr>
              <th>Class</th><th>Term Amount</th><th>Yearly Amount</th>
              <th>Term 1 Month</th><th>Term 2 Month</th><th>Term 3 Month</th><th>Term 4 Month</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {editableRows.map((row) => (
              <tr key={row.className}>
                <td><strong>{row.className}</strong></td>
                <td>
                  <input
                    aria-label={`${row.className} term amount`}
                    type="number"
                    min="1"
                    step="0.01"
                    value={row.termAmount || ""}
                    onChange={(event) => updateRow(row.className, "termAmount", event.target.value)}
                  />
                </td>
                <td>{money(row.termAmount * 4)}</td>
                {(["term1Month", "term2Month", "term3Month", "term4Month"] as const).map((field) => (
                  <td key={field}>
                    <input
                      aria-label={`${row.className} ${field}`}
                      value={row[field]}
                      readOnly={!advancedOverride}
                      onChange={(event) => updateRow(row.className, field, event.target.value)}
                    />
                  </td>
                ))}
                <td><span className={`badge ${row.status === "Saved" || row.status === "Existing" ? "success" : row.status === "Unsaved" ? "warn" : ""}`}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fee-structure-footer">
        <button type="button" onClick={saveAll} disabled={saving}>
          {saving ? "Saving All..." : "Save All Fee Structures"}
        </button>
        {message ? <span className={messageType === "success" ? "success-text" : "error"} role="status">{message}</span> : null}
      </div>
    </section>
  );
}

function editorRows(rows: ExistingFeeStructure[], academicYear: string): EditableRow[] {
  return buildFeeStructureEditorRows(rows, academicYear).map((row) => ({
    ...row,
    status: row.exists ? "Existing" : "New"
  }));
}
