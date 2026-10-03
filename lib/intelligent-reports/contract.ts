export const FAMILIES = ["ACADEMIC", "ATTENDANCE", "FEES"] as const;
export type Family = typeof FAMILIES[number];
export type Comparator = "LT" | "LTE" | "GT" | "GTE";
/** Date buckets partition the interval; diagnostics can overlap and are never added as days. */
export const ATTENDANCE_BUCKETS = ["COUNTED_PRESENT","COUNTED_ABSENT","MISSING_SESSION","SESSION_NOT_LOCKED","MISSING_RECORD","UNSUPPORTED_STATUS","UNSUPPORTED_DAY","EXCLUDED_CALENDAR","OUTSIDE_ENROLLMENT"] as const;
export type AttendanceBucket = typeof ATTENDANCE_BUCKETS[number];
export type AttendanceReason = "UNKNOWN_ADMISSION" | "TRANSFER_HISTORY" | "PENDING_RECONCILIATION" | "CALENDAR_BASIS_MISMATCH" | "BEFORE_ENROLLMENT" | "ON_OR_AFTER_EXIT" | "NON_WORKING_DAY" | "VACATION_DAY" | "EMERGENCY_CLOSURE" | "UNSUPPORTED_DAY" | "UNSUPPORTED_STATUS" | "MISSING_SESSION" | "SESSION_NOT_LOCKED" | "MISSING_RECORD" | "ZERO_ELIGIBLE_DAYS";
export type AttendanceDateEvidence = {
  date:string;
  calendar:{scope:string;type:string;publicationReference:string;version:number;dayReference:string};
  eligibility:"ELIGIBLE_FULL_DAY"|"OUTSIDE_ENROLLMENT"|"EXCLUDED_CALENDAR"|"UNSUPPORTED_DAY";
  session:"MISSING"|"DRAFT"|"SUBMITTED"|"LOCKED"|"UNSUPPORTED";
  record:"MISSING"|"PRESENT";
  status:"PRESENT"|"ABSENT"|"LATE"|"HALF_DAY"|"EXCUSED"|"UNSUPPORTED"|null;
  numerator:0|1;denominator:0|1;recorded:0|1;
  bucket:AttendanceBucket;reasons:AttendanceReason[];
};
export type AttendanceEvidence = {
  academicYear:string;className:string;section:string;from:string;to:string;
  criterion:{comparator:Comparator;threshold:number};
  state:"COMPLETE"|"INCOMPLETE"|"NO_ELIGIBLE_DAYS";
  numerator:number;denominator:number;recorded:number;percentage:number|null;
  coverage:Record<AttendanceBucket,number>;totalDates:number;
  intervalReasons:AttendanceReason[];
  transferDates:string[];
  dates:AttendanceDateEvidence[];
};
export type Target = { id: string; className: string; section: string; exams: { id: string; code: string; name: string }[] };
export type Query = {
  family: Family; schoolId: "school"; academicYear: string;
  targets: { id: string; examId?: string }[];
  comparator: Comparator; threshold: number; sourceState: "ISSUED" | "LOCKED" | "CURRENT";
  from?: string; to?: string; term?: number;
  sort: "NAME" | "METRIC"; direction: "ASC" | "DESC"; page: number; pageSize: number;
};
export class ReportError extends Error {
  constructor(message: string, public code = "INVALID_QUERY", public status = 400) { super(message); }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReportError("A JSON object is required.");
  return value as Record<string, unknown>;
}
export function keys(row: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(row).some(key => !allowed.includes(key))) throw new ReportError("Unsupported fields or conditions.");
}
const id = (value: unknown) => { if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new ReportError("Choose an exact authorised source."); return value; };
export function year(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value) || Number(value.slice(5)) !== (Number(value.slice(0,4)) + 1) % 100) throw new ReportError("Choose an exact academic year.");
  return value;
}
export function parseQuery(value: unknown): Query {
  const row = object(value);
  keys(row, ["family","schoolId","academicYear","targets","comparator","threshold","sourceState","from","to","term","sort","direction","page","pageSize"]);
  if (!FAMILIES.includes(row.family as Family) || row.schoolId !== "school") throw new ReportError("Choose a supported family and school.");
  const family = row.family as Family, academicYear = year(row.academicYear);
  if (!Array.isArray(row.targets) || !row.targets.length || row.targets.length > 40) throw new ReportError("Select 1–40 exact class/section scopes; an empty selection never means whole school.");
  const targets = row.targets.map(value => { const t = object(value); keys(t,["id","examId"]); return { id: id(t.id), ...(t.examId === undefined ? {} : { examId:id(t.examId) }) }; }).sort((a,b)=>a.id.localeCompare(b.id));
  if (new Set(targets.map(t=>t.id)).size !== targets.length) throw new ReportError("Duplicate class/section scope.");
  if (!["LT","LTE","GT","GTE"].includes(String(row.comparator))) throw new ReportError("Choose a supported comparison.");
  if (typeof row.threshold !== "number" || !Number.isFinite(row.threshold) || row.threshold < 0 || row.threshold > 100) throw new ReportError("Threshold must be between 0 and 100.");
  const sourceState = family === "ACADEMIC" ? "ISSUED" : family === "ATTENDANCE" ? "LOCKED" : "CURRENT";
  if (row.sourceState !== sourceState) throw new ReportError("Unsupported source state; drafts and historical balances are unavailable.");
  if (family === "ACADEMIC" && targets.some(t=>!t.examId)) throw new ReportError("Select the exact examination for every class/section.", "CONTEXT_REQUIRED");
  if (family !== "ACADEMIC" && targets.some(t=>t.examId)) throw new ReportError("Examination context does not define attendance or fee scope.");
  if (family !== "ATTENDANCE" && (row.from !== undefined || row.to !== undefined)) throw new ReportError("Historical fee cutoffs are unsupported; balances are current.");
  if (family !== "FEES" && row.term !== undefined) throw new ReportError("A fee term is valid only for fee reports.");
  if (family === "FEES" && (!Number.isInteger(row.term) || Number(row.term) < 1 || Number(row.term) > 4 || row.comparator !== "GT" || row.threshold !== 0)) throw new ReportError("Choose Term 1–4; outstanding means balance greater than zero.");
  if (family === "ATTENDANCE") {
    for (const value of [row.from,row.to]) {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value || value < `${academicYear.slice(0,4)}-04-01` || value > `${Number(academicYear.slice(0,4))+1}-03-31`) throw new ReportError("Choose real dates within the selected academic year.", "CONTEXT_REQUIRED");
    }
    if (String(row.from)>String(row.to)) throw new ReportError("Start date must precede end date.");
  }
  if (!["NAME","METRIC"].includes(String(row.sort)) || !["ASC","DESC"].includes(String(row.direction))) throw new ReportError("Unsupported sorting.");
  if (!Number.isInteger(row.page) || Number(row.page)<1 || Number(row.page)>100 || ![25,50,100].includes(Number(row.pageSize)) || typeof row.pageSize !== "number") throw new ReportError("Unsupported pagination.");
  return { family,schoolId:"school",academicYear,targets,comparator:row.comparator as Comparator,threshold:row.threshold,sourceState,sort:row.sort as Query["sort"],direction:row.direction as Query["direction"],page:Number(row.page),pageSize:Number(row.pageSize),...(family === "ATTENDANCE" ? {from:String(row.from),to:String(row.to)} : {}),...(family === "FEES" ? {term:Number(row.term)} : {}) };
}
export function matches(value: number, comparator: Comparator, threshold: number) {
  return comparator === "LT" ? value < threshold : comparator === "LTE" ? value <= threshold : comparator === "GT" ? value > threshold : value >= threshold;
}
const alias = (s:string) => s.toLowerCase().replace(/^class\s*/,"").replace(/[\s-]/g,"");
export function interpretQuestion(question: unknown, context: unknown, options: Target[]): Query {
  if (typeof question !== "string" || question.length > 300 || !question.trim()) throw new ReportError("Enter a supported question of at most 300 characters.");
  const text = question.trim().replace(/\s+/g," ").toLowerCase();
  if (text.includes("slow learner")) throw new ReportError("Students needing academic support: select an examination and measurable percentage criterion.","CONTEXT_REQUIRED");
  const row = {...object(context)};
  let academic = /^students(?: scoring)? (below|at most|above|at least) (\d+(?:\.\d+)?)%(?: in (.+))?$/.exec(text);
  const attendance = /^attendance (below|at most|above|at least) (\d+(?:\.\d+)?)% between (\d{4}-\d{2}-\d{2}) and (\d{4}-\d{2}-\d{2})$/.exec(text);
  const fees = /^outstanding fees for term ([1-4]) in (\d{4}-\d{2})$/.exec(text);
  const operators: Record<string,Comparator> = {below:"LT","at most":"LTE",above:"GT","at least":"GTE"};
  if (academic) {
    row.family="ACADEMIC";row.sourceState="ISSUED";row.comparator=operators[academic[1]];row.threshold=Number(academic[2]);delete row.from;delete row.to;delete row.term;
    if (academic[3]) {
      const supplied = academic[3];
      const existing = Array.isArray(row.targets) ? row.targets.map(object) : [];
      const examMatches = options.flatMap(t=>t.exams.filter(e=>e.name.toLowerCase()===supplied||e.code.toLowerCase()===supplied).map(e=>({target:t.id,exam:e.id})));
      if (examMatches.length) {
        if (!existing.length) throw new ReportError("Select exact class/section scopes.","CONTEXT_REQUIRED");
        const selectedMatches = existing.map(t=>examMatches.filter(m=>m.target===t.id));
        const ids = new Set(selectedMatches.flat().map(m=>m.exam));
        row.targets = existing.map((t,i)=>{
          const exact=selectedMatches[i].filter(m=>!t.examId||m.exam===t.examId);
          if(exact.length!==1 || (ids.size>1&&!t.examId))throw new ReportError("Similar examination names do not establish equivalence. Select the exact examination for each scope.","CONTEXT_REQUIRED");
          return {id:t.id,examId:exact[0].exam};
        });
      } else {
        row.targets = supplied.split(/\s+and\s+|\s*,\s*/).map(name=>{const found=options.filter(t=>alias(t.className+t.section)===alias(name));if(found.length!==1)throw new ReportError("Unknown or ambiguous class/section; use the authorised choices.","CONTEXT_REQUIRED");const chosen=existing.find(t=>t.id===found[0].id);return {id:found[0].id,...(chosen?.examId?{examId:chosen.examId}:{})};});
      }
    }
  } else if (attendance) {
    row.family="ATTENDANCE";row.sourceState="LOCKED";row.comparator=operators[attendance[1]];row.threshold=Number(attendance[2]);row.from=attendance[3];row.to=attendance[4];delete row.term;
    row.targets=Array.isArray(row.targets)?row.targets.map(v=>({id:object(v).id})):[];
  } else if (fees) {
    row.family="FEES";row.sourceState="CURRENT";row.comparator="GT";row.threshold=0;row.term=Number(fees[1]);row.academicYear=fees[2];delete row.from;delete row.to;
    row.targets=Array.isArray(row.targets)?row.targets.map(v=>({id:object(v).id})):[];
  } else throw new ReportError("Unsupported wording or extra conditions. Use the structured filters.","UNSUPPORTED_QUESTION");
  return parseQuery({...row,page:1});
}
