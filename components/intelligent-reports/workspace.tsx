"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import type { Family,Query,Target } from "@/lib/intelligent-reports/contract";
import { parseQuery } from "@/lib/intelligent-reports/contract";
import type { Report } from "@/lib/intelligent-reports/service";
import { RequestGeneration } from "@/lib/intelligent-reports/request-generation";
import styles from "./workspace.module.css";

type Detail={row:Report["rows"][number];definition:string;generatedAt:string;sourceRevision:string};
type Access={families:Family[];years:string[];context:string};
const labels:Record<Family,string>={ACADEMIC:"Academic support",ATTENDANCE:"Student attendance",FEES:"Term fee outstanding"};
const fresh=(family:Family,academicYear:string):Query=>({family,academicYear,schoolId:"school",targets:[],sourceState:family==="ACADEMIC"?"ISSUED":family==="ATTENDANCE"?"LOCKED":"CURRENT",comparator:family==="FEES"?"GT":"LT",threshold:family==="FEES"?0:family==="ACADEMIC"?60:80,sort:"NAME",direction:"ASC",page:1,pageSize:25,...(family==="FEES"?{term:2}:{})});
async function request<T>(action:string,body:unknown,signal:AbortSignal):Promise<T>{
  const response=await fetch(`/api/intelligent-reports/${action}`,{method:body===undefined?"GET":"POST",cache:"no-store",credentials:"same-origin",signal,...(body===undefined?{}:{headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})});
  if(!response.ok){const data=await response.json();throw new Error(data.error||"Report unavailable.");}
  return response.json();
}
export function Workspace({initialAccess}:{initialAccess:Access}) {
  const [access,setAccess]=useState(initialAccess),[query,setQuery]=useState<Query>(()=>fresh(initialAccess.families[0]??"ACADEMIC",initialAccess.years[0]??""));
  const [targets,setTargets]=useState<Target[]>([]),[question,setQuestion]=useState(""),[review,setReview]=useState<Query|null>(null),[report,setReport]=useState<Report|null>(null);
  const [detail,setDetail]=useState<Detail|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const requests=useRef(new RequestGeneration()),heading=useRef<HTMLHeadingElement>(null),sourceButton=useRef<HTMLButtonElement|null>(null);
  const clear=useCallback(()=>{requests.current.invalidate();setReview(null);setReport(null);setDetail(null);setBusy(false);setError("");setNotice("");},[]);
  const edit=(next:Query)=>{clear();setQuery({...next,page:1});};
  useEffect(()=>{
    setTargets([]);const controller=new AbortController();
    if(query.academicYear&&access.families.includes(query.family))request<{targets:Target[]}>("options",{family:query.family,academicYear:query.academicYear},controller.signal).then(data=>{if(!controller.signal.aborted)setTargets(data.targets);}).catch(e=>{if(!controller.signal.aborted){setReview(null);setError(e.message);}});
    return()=>controller.abort();
  },[query.family,query.academicYear,access.context,access.families,clear]);
  useEffect(()=>{if(report)heading.current?.focus();},[report]);
  useEffect(()=>{
    let controller=new AbortController();let stopped=false;
    const check=async()=>{try{const latest=await request<Access>("access",undefined,controller.signal);if(stopped)return;if(latest.context!==access.context||latest.families.join()!==access.families.join()){clear();setQuestion("");setTargets([]);setQuery(fresh(latest.families[0]??"ACADEMIC",latest.years[0]??""));setAccess(latest);}}catch(e){if(!controller.signal.aborted){clear();setAccess(a=>({...a,families:[]}));setError(e instanceof Error?e.message:"Access changed.");}}};
    const visibility=()=>{clear();setQuestion("");if(document.visibilityState==="visible")void check();};
    const interval=setInterval(()=>void check(),30000);window.addEventListener("pagehide",visibility);document.addEventListener("visibilitychange",visibility);
    return()=>{stopped=true;controller.abort();clearInterval(interval);window.removeEventListener("pagehide",visibility);document.removeEventListener("visibilitychange",visibility);requests.current.invalidate();};
  },[access.context,access.families,clear]);
  const perform=async(action:"interpret"|"run"|"source"|"export",next=query,key?:string)=>{
    const token=requests.current.begin();setBusy(true);setError("");setNotice("");
    try {
      if(action==="interpret"){
        const data=await request<{query:Query}>(action,{question,context:next},token.signal);if(!requests.current.current(token.generation))return;
        setQuery(data.query);setReview(data.query);setReport(null);setNotice("Interpretation ready. Review the exact scope before running.");
      } else if(action==="export") {
        const response=await fetch("/api/intelligent-reports/export",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:next,expectedRevision:report?.sourceRevision}),signal:token.signal});
        if(!response.ok){const data=await response.json();throw new Error(data.error||"Export denied.");}
        const blob=await response.blob();if(!requests.current.current(token.generation))return;
        const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`nalanda-${next.family.toLowerCase()}-${next.academicYear}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice("CSV generated from newly authorised sources matching this revision.");
      } else {
        const body={query:next,...(report?{expectedRevision:report.sourceRevision}:{}),...(key?{key}:{})};
        if(action==="source"){const data=await request<Detail>(action,body,token.signal);if(requests.current.current(token.generation))setDetail(data);}
        else {const data=await request<Report>(action,body,token.signal);if(!requests.current.current(token.generation))return;setReport(data);setQuery(next);setReview(next);setNotice("Report complete. Unresolved evidence is shown separately.");heading.current?.focus();}
      }
    }catch(e){if(requests.current.current(token.generation)){setReport(null);setDetail(null);setError(e instanceof Error?e.message:"Request failed.");}}
    finally{if(requests.current.current(token.generation))setBusy(false);}
  };
  const choose=(id:string,checked:boolean)=>edit({...query,targets:checked?[...query.targets,{id}]:query.targets.filter(t=>t.id!==id)});
  const reviewBuilder=()=>{clear();try{setReview(parseQuery(query));setNotice("Filters ready for review.");}catch(e){setError((e as Error).message);}};
  return <section className={styles.workspace} aria-labelledby="ask-title">
    <header className={styles.header}><div><h1 id="ask-title">Ask Nalanda</h1><p>Management reports with clear sources, scope and coverage.</p></div><span>Read-only reports</span></header>
    {!access.families.length?<p role="status">No reporting domain is available for this account. Access changes use the existing governance controls.</p>:<>
    <div className={styles.families} role="group" aria-label="Report family">{access.families.map(f=><button key={f} type="button" aria-pressed={query.family===f} onClick={()=>edit(fresh(f,query.academicYear))}>{labels[f]}</button>)}</div>
    <form onSubmit={e=>{e.preventDefault();void perform("interpret");}} className={styles.question}>
      <label htmlFor="question">Ask a supported question</label><div><input id="question" value={question} maxLength={300} autoComplete="off" onChange={e=>{clear();setQuestion(e.target.value);}} placeholder={query.family==="ACADEMIC"?"students below 60% in 7A and 9B":query.family==="ATTENDANCE"?"attendance below 80% between 2026-06-01 and 2026-06-30":"outstanding fees for Term 2 in 2026-27"}/><button disabled={busy||!question.trim()} type="submit">Interpret</button></div>
      <p className={styles.muted}>Supports below, at most, above and at least. Select the year, scope and examination below. Extra conditions require structured filters.</p>
    </form>
    <section className={styles.filters} aria-labelledby="filters-title"><h2 id="filters-title">Build the same report</h2>
      <div className={styles.grid}><label>Academic year<select value={query.academicYear} onChange={e=>edit(fresh(query.family,e.target.value))}><option value="">Select a year</option>{access.years.map(y=><option key={y}>{y}</option>)}</select></label>
      {query.family!=="FEES"?<><label>Comparison<select value={query.comparator} onChange={e=>edit({...query,comparator:e.target.value as Query["comparator"]})}><option value="LT">Below (&lt;)</option><option value="LTE">At most (≤)</option><option value="GT">Above (&gt;)</option><option value="GTE">At least (≥)</option></select></label><label>Percentage threshold<input type="number" min="0" max="100" step="0.01" value={query.threshold} onChange={e=>edit({...query,threshold:e.target.value===""?NaN:Number(e.target.value)})}/></label></>:<label>Fee term<select value={query.term} onChange={e=>edit({...query,term:Number(e.target.value)})}>{[1,2,3,4].map(t=><option key={t} value={t}>Term {t}</option>)}</select></label>}
      {query.family==="ATTENDANCE"?<><label>From<input type="date" value={query.from??""} onChange={e=>edit({...query,from:e.target.value})}/></label><label>To<input type="date" value={query.to??""} onChange={e=>edit({...query,to:e.target.value})}/></label></>:null}</div>
      <fieldset className={styles.scopes}><legend>Exact class and section scope</legend><button type="button" onClick={()=>edit({...query,targets:targets.map(t=>({id:t.id,...(query.targets.find(v=>v.id===t.id)?.examId?{examId:query.targets.find(v=>v.id===t.id)!.examId}:{})}))})}>Select all listed scopes</button><p className={styles.muted}>Empty selection never means whole school. Every selected scope needs its own examination mapping.</p>
      {targets.map(t=><div className={styles.scope} key={t.id}><label><input type="checkbox" checked={query.targets.some(v=>v.id===t.id)} onChange={e=>choose(t.id,e.target.checked)}/>{t.className}{t.section}</label>{query.family==="ACADEMIC"&&query.targets.some(v=>v.id===t.id)?<label>Examination for {t.className}{t.section}<select value={query.targets.find(v=>v.id===t.id)?.examId??""} onChange={e=>edit({...query,targets:query.targets.map(v=>v.id===t.id?{id:t.id,examId:e.target.value}:v)})}><option value="">Select exact examination</option>{t.exams.map(ex=><option key={ex.id} value={ex.id}>{ex.name} ({ex.code})</option>)}</select></label>:null}</div>)}</fieldset>
      <div className={styles.grid}><label>Sort<select value={query.sort} onChange={e=>edit({...query,sort:e.target.value as Query["sort"]})}><option value="NAME">Student name</option><option value="METRIC">Metric</option></select></label><label>Order<select value={query.direction} onChange={e=>edit({...query,direction:e.target.value as Query["direction"]})}><option value="ASC">Ascending</option><option value="DESC">Descending</option></select></label></div>
      <button type="button" onClick={reviewBuilder}>Review structured filters</button>
    </section>
    {review?<section className={styles.review} aria-label="Interpreted query"><h2>Review before running</h2><p>{labels[review.family]} · {review.academicYear} · {review.sourceState}</p><p>{review.targets.map(t=>{const scope=targets.find(x=>x.id===t.id);return `${scope?.className??"Scope"}${scope?.section??""}${t.examId?` / ${scope?.exams.filter(x=>x.id===t.examId).map(x=>`${x.name} (${x.code})`).join()||"selected examination"}`:""}`;}).join("; ")}</p><p>{review.family==="FEES"?`Term ${review.term}, current balance greater than zero; not a historical as-of report.`:`${review.comparator} ${review.threshold}%${review.from?` · ${review.from} to ${review.to}`:""}`}</p><button disabled={busy} onClick={()=>void perform("run",review)}>Run report</button></section>:null}
    <div className={styles.actions}><button disabled={!busy} onClick={()=>{clear();setNotice("Cancelled. Previous results cleared.");}}>Cancel</button><button onClick={()=>{clear();setQuestion("");setQuery(fresh(query.family,query.academicYear));}}>Reset</button></div>
    </>}
    <p role="status" aria-live="polite">{busy?"Reading authorised sources…":notice}</p>{error?<p role="alert" className={styles.error}>{error}</p>:null}
    {report?<section aria-labelledby="results-title"><div className={styles.header}><h2 tabIndex={-1} ref={heading} id="results-title">Report results</h2><button disabled={busy} onClick={()=>void perform("export")}>Export authorised CSV</button></div>
      <dl className={styles.summary}>{[["Population",report.summary.population],["Meets criterion",report.summary.meets],["Does not meet",report.summary.doesNotMeet],["Unresolved",report.summary.unresolved]].map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
      <p>{report.definition}</p><p className={styles.muted}>{report.notice} Generated {report.generatedAt}.</p>{report.summary.outstandingPaise!==null?<p>Classified outstanding total: ₹{(report.summary.outstandingPaise/100).toFixed(2)}. Unresolved balances are excluded.</p>:null}
      {!report.summary.population?<p>No Students in the admitted enrolment scope.</p>:<div className={styles.table}><table><caption>{report.scope.join("; ")}. All three classifications are included.</caption><thead><tr><th>Student</th><th>Scope</th><th>{query.family==="FEES"?"Outstanding":"Percentage"}</th><th>{query.family==="FEES"?"Paid / liability (paise)":"Numerator / denominator"}</th><th>Classification</th><th>Source</th></tr></thead><tbody>{report.rows.map(row=><tr key={row.key}><td>{row.name}<small>{row.admission}</small></td><td>{row.className}{row.section}</td><td>{row.metric===null?"Unresolved":query.family==="FEES"?`₹${(row.metric/100).toFixed(2)}`:`${row.metric.toFixed(2)}%`}</td><td>{row.numerator??"—"} / {row.denominator??"—"}</td><td>{row.classification.replaceAll("_"," ")}<small>{row.state}</small></td><td><button onClick={e=>{sourceButton.current=e.currentTarget;void perform("source",query,row.key);}}>Details</button></td></tr>)}</tbody></table></div>}
      <div className={styles.actions}><button disabled={busy||query.page===1} onClick={()=>void perform("run",{...query,page:query.page-1})}>Previous</button><span>Page {query.page} of {Math.max(1,Math.ceil(report.summary.population/query.pageSize))}</span><button disabled={busy||query.page*query.pageSize>=report.summary.population} onClick={()=>void perform("run",{...query,page:query.page+1})}>Next</button></div>
    </section>:null}
    {detail?<SourceDetails detail={detail} close={()=>{setDetail(null);sourceButton.current?.focus();}}/>:null}
  </section>;
}
function SourceDetails({detail,close}:{detail:Detail;close:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog className={styles.dialog} ref={ref} onCancel={e=>{e.preventDefault();close();}} aria-labelledby="source-title"><h2 id="source-title">Source details</h2><p>{detail.row.name} · {detail.row.admission}</p><p>{detail.row.source||"Source unavailable"}</p><p>{detail.row.className}{detail.row.section} · {detail.row.state}</p><p>Metric: {detail.row.metric??"Unresolved"}; numerator {detail.row.numerator??"unavailable"}, denominator {detail.row.denominator??"unavailable"}.</p><p>Generated / current balance cutoff: {detail.generatedAt}. Report revision: {detail.sourceRevision}.</p><p>{detail.row.explanation}</p><p>{detail.definition}</p>{detail.row.href?<a href={detail.row.href}>Open existing authorised record</a>:null}<p className={styles.muted}>Record access is checked independently. Source revision: {detail.row.revision||"Unavailable"}</p><button onClick={close}>Close source details</button></dialog>;
}
