import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {PDFDocument,PDFName,PDFDict,PDFArray,PDFRawStream,decodePDFRawStream} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {GRADUATION_DISCLAIMER} from "../../lib/certificate-templates";

/** Bounded inspection of the actual embedded Georgia font and per-page PDF
 * drawing streams. No OCR, external service, font extraction to disk or upload. */
export async function inspectCertificateDocument(bytes:Buffer,mode:"DRAFT"|"ISSUED",fontHash?:string,expected?:{studentName:string;academicYear:string}){
 assert(bytes.length>0&&bytes.length<=16*1024*1024&&bytes.subarray(0,5).toString()==="%PDF-");
 const doc=await PDFDocument.load(bytes);assert(doc.getPageCount()>0&&doc.getPageCount()<=4);
 assert.equal(doc.getTitle(),mode==="DRAFT"?"DRAFT - NOT OFFICIAL":"School-issued certificate");
 const drawn:string[]=[];let encode:((v:string)=>string)|undefined;
 for(const page of doc.getPages()){
  const fonts=page.node.Resources()?.lookup(PDFName.of("Font"),PDFDict);assert(fonts);assert(fonts.keys().length>0&&fonts.keys().length<=1024);
  // pdf-lib assigns several resource names to the same embedded font as it
  // draws paragraphs. Every alias must resolve to that one actual font.
  const first=fonts.get(fonts.keys()[0])?.toString();assert(first);assert(fonts.keys().every(k=>fonts.get(k)?.toString()===first));
  const type0=fonts.lookup(fonts.keys()[0],PDFDict),descendant=type0.lookup(PDFName.of("DescendantFonts"),PDFArray).lookup(0,PDFDict);
  const stream=descendant.lookup(PDFName.of("FontDescriptor"),PDFDict).lookup(PDFName.of("FontFile2")) as PDFRawStream;
  const fontBytes=decodePDFRawStream(stream).decode();assert(fontBytes.length<=2*1024*1024);
  const font=(fontkit as any).create(fontBytes);assert.equal(font.familyName,"Georgia");assert(/bold/i.test(font.subfamilyName));
  if(fontHash)assert.equal(createHash("sha256").update(fontBytes).digest("hex"),fontHash);
  const contents=page.node.Contents();assert(contents);const streams=contents instanceof PDFArray?contents.asArray().map(r=>doc.context.lookup(r) as PDFRawStream):[contents as PDFRawStream];
  const text=streams.map(s=>{const raw=decodePDFRawStream(s).decode();assert(raw.length<=1024*1024);return Buffer.from(raw).toString("latin1");}).join("\n");
  const encoded=(value:string)=>"<"+font.layout(value).glyphs.map((g:any)=>g.id.toString(16).padStart(4,"0").toUpperCase()).join("")+">";
  const space=encoded(" ").slice(1,-1),compact=(hex:string)=>(hex.match(/.{4}/g)??[]).filter(g=>g!==space).join("");encode=value=>compact(encoded(value).slice(1,-1));
  drawn.push(Array.from(text.matchAll(/<([A-Fa-f0-9]+)>\s*Tj/g),m=>compact(m[1].toUpperCase())).join(""));
  assert(text.includes(encoded("NALANDA PUBLIC SCHOOL")),"CERTIFICATE_SCHOOL_HEADER_MISSING");
  if(mode==="DRAFT"){assert(text.includes(encoded("DRAFT – NOT OFFICIAL")),"DRAFT_PAGE_WATERMARK_MISSING");assert(/\s30 Tf/.test(text),"DRAFT_PAGE_WATERMARK_SIZE_MISSING");}
 }
 assert(encode);const text=drawn.join("");
 for(const value of [GRADUATION_DISCLAIMER,"School completion is distinct from passing a Board examination. No Board-pass claim is made.",...(expected?[`Student: ${expected.studentName}`,`Academic year: ${expected.academicYear}`]:[])])assert(text.includes(encode(value)),"CERTIFICATE_DRAWN_FACT_OR_DISCLAIMER_MISSING");
 return {pages:doc.getPageCount(),fontFamily:"Georgia Bold",mode};
}
