"use client";
import {useId,useState} from "react";
import type {AttendanceEvidence,AttendanceReason,AttendanceBucket} from "@/lib/intelligent-reports/contract";
import styles from "./workspace.module.css";

const reasons:Record<AttendanceReason,string>={
  UNKNOWN_ADMISSION:"Admission date is unknown; the eligible interval cannot be confirmed.",
  TRANSFER_HISTORY:"A retained class/section transfer needs policy resolution for this interval.",
  PENDING_RECONCILIATION:"The published calendar requires attendance reconciliation.",
  CALENDAR_BASIS_MISMATCH:"The locked session refers to a different calendar basis.",
  BEFORE_ENROLLMENT:"Before the enrollment start date.",ON_OR_AFTER_EXIT:"On or after the exclusive exit date.",
  NON_WORKING_DAY:"Published non-working day.",VACATION_DAY:"Published vacation day.",EMERGENCY_CLOSURE:"Published emergency closure.",
  UNSUPPORTED_DAY:"Partial or unsupported calendar day; no fractional day is inferred.",
  UNSUPPORTED_STATUS:"Recorded status has no supported full-day calculation policy.",
  MISSING_SESSION:"No attendance session exists for this date and scope.",SESSION_NOT_LOCKED:"The attendance session is not locked.",
  MISSING_RECORD:"The locked session has no record for this student.",ZERO_ELIGIBLE_DAYS:"No eligible full working days; a percentage cannot be calculated."
};
const buckets:Record<AttendanceBucket,string>={COUNTED_PRESENT:"Recorded present",COUNTED_ABSENT:"Recorded absent",MISSING_SESSION:"Missing session",SESSION_NOT_LOCKED:"Session not locked",MISSING_RECORD:"Missing student record",UNSUPPORTED_STATUS:"Unsupported status",UNSUPPORTED_DAY:"Unsupported day",EXCLUDED_CALENDAR:"Excluded calendar date",OUTSIDE_ENROLLMENT:"Outside enrollment"};
const comparisons={LT:"Below",LTE:"At most",GT:"Above",GTE:"At least"};
const exclusions=new Set<AttendanceReason>(["BEFORE_ENROLLMENT","ON_OR_AFTER_EXIT","NON_WORKING_DAY","VACATION_DAY","EMERGENCY_CLOSURE"]);
export function AttendanceEvidenceView({evidence}:{evidence:AttendanceEvidence}) {
  const [filter,setFilter]=useState("ALL"),id=useId();
  const dates=evidence.dates.filter(day=>filter==="ALL"||filter==="COUNTED"&&(day.bucket==="COUNTED_PRESENT"||day.bucket==="COUNTED_ABSENT")||filter==="ATTENTION"&&(evidence.intervalReasons.some(r=>r!=="ZERO_ELIGIBLE_DAYS")||day.reasons.some(r=>!exclusions.has(r)))||filter==="EXCLUDED"&&(day.bucket==="OUTSIDE_ENROLLMENT"||day.bucket==="EXCLUDED_CALENDAR"));
  return <section aria-label="Attendance evidence">
    <p className={styles.period}><strong>Academic year {evidence.academicYear}</strong><br/>{evidence.from} to {evidence.to} · Class {evidence.className}{evidence.section}</p>
    <p>Criterion: {comparisons[evidence.criterion.comparator]} {evidence.criterion.threshold}%.</p>
    <p role="status"><strong>{evidence.state==="COMPLETE"?"Complete":evidence.state==="NO_ELIGIBLE_DAYS"?"No eligible days":"Incomplete"}</strong> · {evidence.percentage===null?"No authoritative percentage or threshold classification":`${evidence.percentage}% authoritative attendance`}</p>
    <p>PRESENT ÷ eligible full working days × 100. Whole-period numerator {evidence.numerator}; denominator {evidence.denominator}; locked records {evidence.recorded}. {evidence.percentage===null?"These are observed counts only, not an official percentage.":"The complete evidence supports the percentage."}</p>
    {evidence.intervalReasons.length?<ul>{evidence.intervalReasons.map(r=><li key={r}>{reasons[r]}</li>)}</ul>:null}
    {evidence.transferDates.length?<p>Transfer relationships requiring attention: {evidence.transferDates.join(", ")}.</p>:null}
    <details><summary>Full-period coverage ({evidence.totalDates} dates)</summary><dl className={styles.coverage}>{Object.entries(evidence.coverage).map(([bucket,count])=><div key={bucket}><dt>{buckets[bucket as AttendanceBucket]}</dt><dd>{count}</dd></div>)}</dl><p>Each date belongs to one coverage bucket. Diagnostic reasons can overlap; they are not additional days. Recorded counts do not override unresolved calendar or interval policy.</p></details>
    <label htmlFor={id}>Dates shown<select id={id} value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">All dates</option><option value="COUNTED">Counted days</option><option value="ATTENTION">Needs attention</option><option value="EXCLUDED">Excluded dates</option></select></label>
    <p role="status">Showing {dates.length} of {evidence.totalDates} dates. Whole-period totals stay unchanged.</p>
    <div className={styles.evidenceTable}><table><caption>Dated attendance decisions, earliest first</caption><thead><tr><th scope="col">Date / calendar</th><th scope="col">Record</th><th scope="col">Contribution</th><th scope="col">Decision / reasons</th></tr></thead><tbody>{dates.map(day=><tr key={day.date}>
      <th scope="row"><time dateTime={day.date}>{day.date}</time><small>{day.calendar.type.replaceAll("_"," ")} · {day.calendar.scope.replaceAll("_"," ")}</small><small>Publication {day.calendar.publicationReference} · v{day.calendar.version}</small></th>
      <td data-label="Record">{day.session.replaceAll("_"," ")} · {day.record==="MISSING"?"No student record":day.status?.replaceAll("_"," ")}</td>
      <td data-label="Contribution">{day.numerator} / {day.denominator}<small>Present / eligible day</small></td>
      <td data-label="Decision">{buckets[day.bucket]}{day.reasons.length?<ul>{day.reasons.map(reason=><li key={reason}>{reasons[reason]}</li>)}</ul>:null}</td>
    </tr>)}</tbody></table></div>
    {!dates.length?<p>No dates match this view.</p>:null}
    <p className={styles.muted}>Current read of retained records for the selected period, not a snapshot of what was known at an earlier time. Later source corrections can change the result. Missing data is not absence; partial days are not automatically 0.5.</p>
  </section>;
}
