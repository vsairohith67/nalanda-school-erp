"use client";

import { useEffect, useState } from "react";

function presentLabel(value: string) {
  return value
    .split(/(\s*[·→]\s*)/)
    .map((part) => /[·→]/.test(part)
      ? part
      : part.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()))
    .join("");
}

export function AdmissionsReports() {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admissions/reports", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setData(body);
      })
      .catch((error) => setMessage(error.message));
  }, []);

  async function download() {
    const response = await fetch("/api/admissions/reports", { method: "POST", cache: "no-store" });
    if (!response.ok) {
      setMessage("Export unavailable.");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "admissions-aggregate-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!data) return <p role="status">{message || "Loading aggregate admissions report…"}</p>;
  const sections = [["Class-wise demand", data.classDemand], ["Source-wise funnel", data.sourceFunnel], ["Enquiry stages", data.enquiryStages], ["Application stages", data.applicationStages], ["Average stage duration", data.averageStageDurationHours]] as const;
  return <div className="admissions-reports"><div className="card admission-report-summary"><span>Conversions</span><strong>{data.conversionTotal}</strong><p>Minimum group size: {data.suppressedMinimumGroupSize}. No Staff ranking is produced.</p><button onClick={download}>Export aggregate CSV</button></div><div className="admission-report-grid">{sections.map(([title, rows]) => <section className="card" key={title}><h2>{title}</h2><table><thead><tr><th>Label</th><th>Count</th>{title.includes("duration") ? <th>Average hours</th> : null}</tr></thead><tbody>{rows.map((row: any) => <tr key={row.label}><td>{presentLabel(row.label)}</td><td>{row.count}</td>{title.includes("duration") ? <td>{row.averageHours ?? "Suppressed"}</td> : null}</tr>)}</tbody></table></section>)}</div><p className="notice">Production use requires an approved admissions privacy notice, retention policy and complaint route. No final legal retention duration is invented here.</p></div>;
}
