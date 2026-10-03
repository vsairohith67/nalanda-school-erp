import {afterEach,it,expect,vi} from "vitest";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {MarksImporter} from "../components/marks-importer";
const state=vi.hoisted(()=>({values:[] as any[]}));
vi.mock("react",async original=>{const actual=await original<typeof import("react")>();return {...actual,useState:()=>[state.values.shift(),vi.fn()],useEffect:()=>{}};});
afterEach(()=>{state.values=[];vi.unstubAllGlobals();});
it("COMPONENT_CONTRACT: interrupted request error remains inside the real confirmation dialog",()=>{
 vi.stubGlobal("React",React);state.values=[[],"","SYNTHETIC",null,"PRIVATE_RECEIPT",true,false,"Failed to fetch",true];
 const html=renderToStaticMarkup(React.createElement(MarksImporter,{})),modal=html.slice(html.indexOf("<dialog"),html.indexOf("</dialog>"));expect(modal).toContain('aria-label="Confirm exact marks draft"');expect(modal).toContain('role="alert"');expect(modal).toContain("Failed to fetch");expect(html.match(/Failed to fetch/g)).toHaveLength(1);expect(html).not.toContain("PRIVATE_RECEIPT");
});
