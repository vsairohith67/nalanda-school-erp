import { describe, expect, it } from "vitest";
import { studentStatusWhere } from "../lib/student-filters";

describe("student status filters", () => {
  it("maps operator-friendly status groups to stored values", () => {
    expect(studentStatusWhere(undefined)).toEqual({});
    expect(studentStatusWhere("Active")).toEqual({ status: "Active" });
    expect(studentStatusWhere("Inactive")).toEqual({ status: "Cancelled" });
    expect(studentStatusWhere("TC_LEFT")).toEqual({ status: { in: ["TC", "Left"] } });
  });
});
