"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CLASS_NAMES, STUDENT_STATUSES, STUDENT_TYPES } from "@/lib/constants";

type StudentInput = {
  id?: string;
  academicYear?: string;
  admissionNo?: string;
  studentName?: string;
  fatherName?: string;
  motherName?: string | null;
  className?: string;
  section?: string | null;
  rollNo?: string | null;
  phone1?: string;
  phone2?: string | null;
  whatsappNumber?: string | null;
  address?: string | null;
  dateOfBirth?: Date | string | null;
  aadhaarNo?: string | null;
  tcStatus?: string | null;
  status?: string;
  studentType?: string;
  discountPercent?: number;
  startMonth?: string;
  remarks?: string | null;
};

export function StudentForm({ student }: { student?: StudentInput }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [className, setClassName] = useState(student?.className ?? "LKG");
  const [studentType, setStudentType] = useState(student?.studentType ?? "Normal");
  const [discountPercent, setDiscountPercent] = useState(student?.discountPercent ?? 0);
  const startMonth = ["IX", "X"].includes(className) ? "April" : "June";

  function changeStudentType(value: string) {
    setStudentType(value);
    if (value === "Faculty Child" && discountPercent === 0) setDiscountPercent(50);
    if (studentType === "Faculty Child" && value !== "Faculty Child" && discountPercent === 50) {
      setDiscountPercent(0);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch(student?.id ? `/api/students/${student.id}` : "/api/students", {
      method: student?.id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(data.error || "Unable to save");
      return;
    }
    router.push("/students");
    router.refresh();
  }

  return (
    <form className="card card-pad form-grid" onSubmit={onSubmit}>
      <label>Academic Year<input name="academicYear" defaultValue={student?.academicYear ?? "2026-27"} /></label>
      <label>Admission No<input name="admissionNo" defaultValue={student?.admissionNo ?? ""} required /></label>
      <label className="wide">Student Name<input name="studentName" defaultValue={student?.studentName ?? ""} required /></label>
      <label>Father Name<input name="fatherName" defaultValue={student?.fatherName ?? ""} required /></label>
      <label>Mother Name<input name="motherName" defaultValue={student?.motherName ?? ""} /></label>
      <label>Class<select name="className" value={className} onChange={(event) => setClassName(event.target.value)}>{CLASS_NAMES.map((c) => <option key={c}>{c}</option>)}</select></label>
      <label>Section<input name="section" defaultValue={student?.section ?? ""} /></label>
      <label>Roll No<input name="rollNo" defaultValue={student?.rollNo ?? ""} /></label>
      <label>Phone 1<input name="phone1" defaultValue={student?.phone1 ?? ""} required /></label>
      <label>Phone 2<input name="phone2" defaultValue={student?.phone2 ?? ""} /></label>
      <label>WhatsApp<input name="whatsappNumber" defaultValue={student?.whatsappNumber ?? ""} /></label>
      <label>Date of Birth<input name="dateOfBirth" type="date" defaultValue={formatDateInput(student?.dateOfBirth)} /></label>
      <label>Aadhaar No<input name="aadhaarNo" defaultValue={student?.aadhaarNo ?? ""} /></label>
      <label>TC Status<input name="tcStatus" defaultValue={student?.tcStatus ?? ""} /></label>
      <label>Status<select name="status" defaultValue={student?.status ?? "Active"}>{STUDENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label>Student Type<select name="studentType" value={studentType} onChange={(event) => changeStudentType(event.target.value)}>{STUDENT_TYPES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <label>Discount %<input name="discountPercent" type="number" min="0" max="100" step="0.01" value={discountPercent} onChange={(event) => setDiscountPercent(Number(event.target.value))} /></label>
      <label>
        Start Month
        <select value={startMonth} disabled aria-label="Start month determined by class">
          <option>April</option><option>June</option>
        </select>
        <input type="hidden" name="startMonth" value={startMonth} />
      </label>
      <label className="full">Address<textarea name="address" defaultValue={student?.address ?? ""} /></label>
      <label className="full">Remarks<textarea name="remarks" defaultValue={student?.remarks ?? ""} /></label>
      {message ? <div className="error full">{message}</div> : null}
      <div className="full"><button disabled={saving}>{saving ? "Saving..." : "Save Student"}</button></div>
    </form>
  );
}

function formatDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
