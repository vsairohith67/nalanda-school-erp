import { describe, expect, it } from "vitest";
import {
  buildStudentImportUpdateData,
  decideStudentImportAction,
  normalizeStudentImportRows
} from "../lib/student-import";
import { normalizeClassName } from "../lib/constants";
import { summarizeStudentTrial } from "../lib/import-verification";

describe("student import upgrade", () => {
  it("maps flexible school column names", () => {
    const preview = normalizeStudentImportRows([{
      "ADM NO": " 8350/26 ",
      "NAME OF THE STUDENT": "ANAYA BEGUM",
      "FATHER NAME": "FARHAN BEGUM",
      Grade: "Class 6",
      SEC: " c ",
      "PHONE NO": "9390565992",
      "Fee Category": "Staff Child",
      "DATE OF BIRTH": "18/06/2015",
      AADHAR: "1234 5678 9012",
      "T.C": ""
    }]);

    expect(preview.rows[0].normalized).toMatchObject({
      admissionNo: "8350/26",
      studentName: "Anaya Begum",
      fatherName: "Farhan Begum",
      className: "VI",
      section: "C",
      studentType: "Faculty Child",
      dateOfBirth: "2015-06-18",
      aadhaarNo: "123456789012"
    });
  });

  it("splits two phone numbers from one column", () => {
    const row = normalizeStudentImportRows([{
      "Admission No": "1/26",
      Name: "Student One",
      Class: "1",
      Phone: "9390565992 / 8885150305"
    }]).rows[0];

    expect(row.normalized.phone1).toBe("9390565992");
    expect(row.normalized.phone2).toBe("8885150305");
  });

  it("normalizes common class variants", () => {
    expect(normalizeClassName("1st")).toBe("I");
    expect(normalizeClassName("Grade 2")).toBe("II");
    expect(normalizeClassName("Class 10")).toBe("X");
    expect(normalizeClassName("NUR")).toBe("Nursery");
    expect(normalizeClassName("PP1")).toBe("LKG");
    expect(normalizeClassName("PP2")).toBe("UKG");
  });

  it("defaults faculty children to 50 percent discount", () => {
    const row = normalizeStudentImportRows([{
      AdmNo: "2/26",
      studentName: "Student Two",
      className: "III",
      Category: "Faculty Child"
    }]).rows[0];

    expect(row.normalized.studentType).toBe("Faculty Child");
    expect(row.normalized.discountPercent).toBe(50);
  });

  it("rejects duplicate admissions within the uploaded file", () => {
    const preview = normalizeStudentImportRows([
      { AdmNo: "3/26", Name: "First", Class: "IV" },
      { AdmNo: "3/26", Name: "Second", Class: "V" }
    ]);

    expect(preview.rows[0].errors).not.toContain("Duplicate admissionNo in uploaded file");
    expect(preview.rows[1].errors).toContain("Duplicate admissionNo in uploaded file");
  });

  it("rejects invalid classes", () => {
    const row = normalizeStudentImportRows([{
      AdmNo: "4/26",
      Name: "Student Four",
      Class: "College"
    }]).rows[0];

    expect(row.errors).toContain("Invalid class");
  });

  it("skips existing admissions in skip and create-only modes", () => {
    expect(decideStudentImportAction(true, "skip")).toBe("skip");
    expect(decideStudentImportAction(true, "create-only")).toBe("skip");
    expect(decideStudentImportAction(false, "create-only")).toBe("create");
  });

  it("summarizes duplicate existing admissions as skipped in safe mode", () => {
    const existingAdmissions = new Set(["pilot-001"]);
    const preview = normalizeStudentImportRows([{
      "Admission No": "PILOT-001",
      Name: "Pilot Student",
      Class: "VI",
      Phone: "9000000001",
      "Father Name": "Pilot Parent"
    }], existingAdmissions);

    expect(preview.counts.existing).toBe(1);
    expect(preview.rows[0].warnings).toContain("Admission number already exists in database");
    expect(summarizeStudentTrial(preview, existingAdmissions, "skip")).toMatchObject({
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 1,
      errorCount: 0
    });
  });

  it("updates existing admissions without blanking absent optional columns", () => {
    const row = normalizeStudentImportRows([{
      AdmNo: "5/26",
      Name: "Updated Student",
      Class: "IX"
    }]).rows[0];
    const update = buildStudentImportUpdateData(row);

    expect(decideStudentImportAction(true, "update")).toBe("update");
    expect(update).toMatchObject({
      admissionNo: "5/26",
      studentName: "Updated Student",
      className: "IX",
      startMonth: "April"
    });
    expect(update).not.toHaveProperty("phone1");
    expect(update).not.toHaveProperty("fatherName");
  });

  it("updates the second phone when it was split from the primary phone column", () => {
    const row = normalizeStudentImportRows([{
      AdmNo: "6/26",
      Name: "Phone Student",
      Class: "VI",
      Phone: "9390565992, 8885150305"
    }]).rows[0];

    expect(buildStudentImportUpdateData(row)).toMatchObject({
      phone1: "9390565992",
      phone2: "8885150305"
    });
  });
});
