"use client";

export function StoredErrorCsvButton({
  errors,
  fileName
}: {
  errors: Array<Record<string, unknown>>;
  fileName: string;
}) {
  if (!errors.length) return null;

  function download() {
    const headers = [...new Set(errors.flatMap((row) => Object.keys(row)))];
    const csv = [
      headers.join(","),
      ...errors.map((row) => headers.map((header) => csvCell(row[header])).join(","))
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <button className="secondary" onClick={download}>Download Stored Error CSV</button>;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
}
