import {afterEach,it,expect,vi} from "vitest";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {PriorYearConcessionsWorkspace} from "../components/prior-year-concessions-workspace";
import PrintPage from "../app/misc-income/[id]/print/page";
const hooks=vi.hoisted(()=>({values:[] as any[],changes:[] as {index:number;value:any}[],index:0}));
vi.mock("react",async original=>{const actual=await original<typeof import("react")>();return {...actual,useState:()=>{const index=hooks.index++;return [hooks.values[index],(value:any)=>hooks.changes.push({index,value})];},useEffect:()=>{},useCallback:(fn:any)=>fn,useRef:(value:any)=>({current:value})};});
vi.mock("next/link",()=>({default:({children,...props}:any)=>React.createElement("a",props,children)}));
vi.mock("../lib/auth",()=>({requirePermission:async()=>({id:"SYNTHETIC"})}));
vi.mock("../lib/prisma",()=>({prisma:{miscIncomeReceipt:{findUnique:async()=>({id:"synthetic",receiptNumber:"SYNTHETIC-RECEIPT",receiptDate:new Date("2026-05-01Z"),status:"ACTIVE",paymentMethod:"CASH",receivedAccount:"CASH_COUNTER",netAmount:"30.75",studentSnapshot:{studentName:"SYNTHETIC",admissionNo:"SYNTHETIC",className:"VI",section:"A"},lines:[{id:"line",itemNameSnapshot:"SYNTHETIC item",quantity:3,unitAmount:"10.25",discountAmount:"0",lineTotal:"30.75"}]})}}}));
vi.mock("../lib/school-settings",()=>({getSchoolSettings:async()=>({schoolName:"NALANDA PUBLIC SCHOOL"})}));
afterEach(()=>{hooks.values=[];hooks.changes=[];hooks.index=0;vi.unstubAllGlobals();});
function elements(tree:any):any[]{if(!tree||typeof tree!=="object")return [];return [tree,...React.Children.toArray(tree.props?.children).flatMap(elements)];}
it("UNIT_OR_DRIVER_CONTRACT: changing case clears income in the same event before selection, without waiting for effects",()=>{
 vi.stubGlobal("React",React);const liability={studentId:"synthetic",sourceYear:"2025-26",operatingYear:"2026-27",provenance:"SYNTHETIC",sourceReferencesJson:"[]"};hooks.values=[{liabilities:[],cases:[{id:"one",liability,status:"DRAFT",requestedAmount:"300",validFrom:"2026-01-01",validTo:"2027-01-01"},{id:"two",liability,status:"DRAFT",requestedAmount:"300",validFrom:"2026-01-01",validTo:"2027-01-01"}],previews:[],history:[]},"one",0,"","",false,"","",null,null,{status:"PROVIDED",exactAnnualAmount:"SYNTHETIC_PRIVATE"}];
 const tree=PriorYearConcessionsWorkspace(),target=elements(tree).find(e=>e.props?.["data-case-id"]==="two");expect(target).toBeTruthy();target.props.onClick();expect(hooks.changes.slice(0,2)).toEqual([{index:10,value:null},{index:1,value:"two"}]);
});
it("UNIT_OR_DRIVER_CONTRACT: real HTML print page requests full school header in Georgia Bold and exact receipt",async()=>{
 vi.stubGlobal("React",React);hooks.values=[false,""];const html=renderToStaticMarkup(await PrintPage({params:Promise.resolve({id:"synthetic"})}));expect(html).toContain('font-family:Georgia, serif;font-weight:700');expect(html).toContain("NALANDA PUBLIC SCHOOL");expect(html).toContain("SYNTHETIC-RECEIPT");expect(html).toContain("30.75");expect(html).not.toContain("Income support");
});
it("UNIT_OR_DRIVER_CONTRACT: known conflict refreshes authoritative queue before busy controls are released",async()=>{
 vi.stubGlobal("React",React);const liability={studentId:"synthetic",sourceYear:"2025-26",operatingYear:"2026-27",provenance:"SYNTHETIC",sourceReferencesJson:"[]"};const c={id:"one",liabilityId:"l",liability,status:"SUBMITTED",version:2,requestedAmount:"300",validFrom:"2026-01-01",validTo:"2027-01-01"},queue={liabilities:[],cases:[c],previews:[],history:[]};hooks.values=[queue,"one",0,"","",false,"SYNTHETIC reason","",null,null,null];
 const current={...queue,cases:[{...c,status:"UNDER_REVIEW",version:3}]};const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:"CASE_VERSION_CHANGED"}),{status:409})).mockResolvedValueOnce(new Response(JSON.stringify(current),{status:200}));vi.stubGlobal("fetch",fetcher);vi.stubGlobal("navigator",{onLine:true});
 const tree=PriorYearConcessionsWorkspace(),control=elements(tree).find(e=>e.type==="button"&&e.props.children==="review");expect(control).toBeTruthy();control.props.onClick();await vi.waitFor(()=>expect(hooks.changes).toContainEqual({index:3,value:"CASE_VERSION_CHANGED"}));expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls[1][0]).toContain("/api/prior-year-concessions?page=0&id=one");const refreshed=hooks.changes.findIndex(v=>v.index===0&&v.value.cases[0].version===3),released=hooks.changes.findIndex(v=>v.index===5&&v.value===false);expect(refreshed).toBeGreaterThanOrEqual(0);expect(released).toBeGreaterThan(refreshed);
});
