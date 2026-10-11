export function ImportRowErrors({ rows }: { rows: { row: number | string; field?: string; messages: string[]; correction?: string }[] }) {
  return <div style={{ minWidth: 0, overflowWrap: "anywhere" }}><p role="status">{rows.length} rows need review.</p>{rows.map((row, i) => <details key={`${row.row}-${i}`}>
    <summary>Row {row.row}{row.field ? ` · ${row.field}` : ""} — {row.messages.length} issue(s)</summary>
    <ul>{row.messages.map((message, j) => <li key={j}>{message}</li>)}</ul><p>{row.correction ?? "Correct the named field in the source or mapping, then validate again."}</p>
  </details>)}</div>;
}
