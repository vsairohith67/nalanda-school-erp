import {afterEach,expect,it,vi} from "vitest";
import React from "react";
import {AcademicReportingWorkspace} from "../components/academic-reporting-workspace";
const hooks=vi.hoisted(()=>({values:[] as any[],refs:[] as any[],cursor:0,refCursor:0,cleanups:[] as any[]}));
vi.mock("react",async original=>{const real=await original<typeof import("react")>();return {...real,useState:(initial:any)=>{const i=hooks.cursor++;if(!(i in hooks.values))hooks.values[i]=typeof initial==="function"?initial():initial;return [hooks.values[i],(v:any)=>{hooks.values[i]=typeof v==="function"?v(hooks.values[i]):v;}];},useRef:(initial:any)=>{const i=hooks.refCursor++;return hooks.refs[i]??(hooks.refs[i]={current:initial});},useMemo:(f:any)=>f(),useEffect:(f:any)=>{hooks.cleanups.push(f());}};});
afterEach(()=>{hooks.values=[];hooks.refs=[];hooks.cursor=hooks.refCursor=0;hooks.cleanups=[];vi.unstubAllGlobals();});
function render(){vi.stubGlobal("React",React);hooks.cursor=hooks.refCursor=0;return AcademicReportingWorkspace({role:"PRINCIPAL",options:[{academicYear:"2025-26",examinationCode:"SYNTHETIC",examinationName:"SYNTHETIC",className:"X",section:"A"}]});}
function nodes(value:any):any[]{return !value||typeof value!=="object"?[]:[value,...React.Children.toArray(value.props?.children).flatMap(nodes)];}
function label(tree:any,name:string){return nodes(tree).find(n=>n.type==="label"&&React.Children.toArray(n.props.children)[0]===name);}
function control(tree:any,name:string){return nodes(label(tree,name)).find(n=>["input","select"].includes(n.type));}
it("COMPONENT_CONTRACT: every report selector invalidates a previous immutable run and aborts pending work",()=>{
 for(const name of ["Report family","Academic year","Class","Section","Assigned subject/paper code"]){const tree=render();hooks.values[9]={runReference:"SYNTHETIC_OLD"};const abort=vi.fn();hooks.refs[1].current={abort};control(tree,name).props.onChange({target:{value:name==="Report family"?"OUTCOME_DISTRIBUTION":"X"}});expect(hooks.values[9]).toBeNull();expect(abort).toHaveBeenCalledOnce();}
});
it("COMPONENT_CONTRACT: late generation cannot restore an exportable run for changed context",async()=>{
 let resolve!:(r:Response)=>void;vi.stubGlobal("fetch",vi.fn(()=>new Promise<Response>(r=>{resolve=r;})));const tree=render(),button=nodes(tree).find(n=>n.type==="button"&&n.props.children==="Generate governed report"),pending=button.props.onClick();control(tree,"Class").props.onChange({target:{value:"X"}});resolve(new Response(JSON.stringify({run:{runReference:"SYNTHETIC_STALE"}})));await pending;expect(hooks.values[9]).toBeNull();expect(hooks.values[11]).toBe(false);
});
it("COMPONENT_CONTRACT: unmount aborts outstanding report work",()=>{render();const abort=vi.fn();hooks.refs[1].current={abort};for(const cleanup of hooks.cleanups)cleanup?.();expect(abort).toHaveBeenCalled();});
