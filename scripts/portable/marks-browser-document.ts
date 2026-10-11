import assert from "node:assert/strict";
import {PDFDocument,PDFName,PDFDict,PDFArray,PDFRawStream,decodePDFRawStream} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
/** Inspect actual bounded downloaded bytes. No external conversion, OCR,
 * font extraction to disk, screenshots, or public document output. */
export async function inspectMarksReportPdf(bytes:Buffer,expected:string[],mode:"COLOUR"|"MONOCHROME"){
 assert(bytes.length>0&&bytes.length<=16*1024*1024&&bytes.subarray(0,5).toString()==="%PDF-","MARKS_PDF_BYTES");
 const doc=await PDFDocument.load(bytes);assert(doc.getPageCount()>0&&doc.getPageCount()<=20,"MARKS_PDF_PAGES");let all="", colourObserved=false;
 for(const page of doc.getPages()){
  const fonts=page.node.Resources()?.lookup(PDFName.of("Font"),PDFDict);assert(fonts,"MARKS_PDF_FONTS");let headerHex:string|undefined;
  for(const key of fonts.keys()){
   const font=fonts.lookup(key,PDFDict);if(font.lookup(PDFName.of("Subtype"))?.toString()!=="/Type0")continue;
   const descendant=font.lookup(PDFName.of("DescendantFonts"),PDFArray).lookup(0,PDFDict),stream=descendant.lookup(PDFName.of("FontDescriptor"),PDFDict).lookup(PDFName.of("FontFile2")) as PDFRawStream;
   const raw=decodePDFRawStream(stream).decode();assert(raw.length<=2*1024*1024,"MARKS_PDF_FONT_BOUND");const parsed=(fontkit as any).create(raw);assert(parsed.familyName==="Georgia"&&/bold/i.test(parsed.subfamilyName),"MARKS_PDF_GEORGIA_REQUIRED");headerHex=parsed.layout("NALANDA PUBLIC SCHOOL").glyphs.map((g:any)=>g.id.toString(16).padStart(4,"0").toUpperCase()).join("");
  }
  const contents=page.node.Contents();assert(contents,"MARKS_PDF_CONTENT");const streams=contents instanceof PDFArray?contents.asArray().map(r=>doc.context.lookup(r) as PDFRawStream):[contents as PDFRawStream];
  const text=streams.map(s=>{const raw=decodePDFRawStream(s).decode();assert(raw.length<=1024*1024,"MARKS_PDF_STREAM_BOUND");return Buffer.from(raw).toString("latin1");}).join("\n");assert(headerHex&&text.includes(`<${headerHex}> Tj`),"MARKS_PDF_SCHOOL_HEADER");
  for(const rgb of text.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) rg/g)){if(mode==="MONOCHROME")assert(rgb[1]===rgb[2]&&rgb[2]===rgb[3],"MARKS_PDF_MONOCHROME");if(Number(rgb[1])===0.06&&Number(rgb[2])===0.25&&Number(rgb[3])===0.42)colourObserved=true;}
  all+=Array.from(text.matchAll(/<([A-Fa-f0-9]+)>\s*Tj/g),m=>Buffer.from(m[1],"hex").toString("latin1")).join(" ");
 }
 if(mode==="COLOUR")assert(colourObserved,"MARKS_PDF_COLOUR_REQUIRED");
 for(const value of expected)assert(all.replace(/\s+/g," ").includes(value),"MARKS_PDF_EXPECTED_VALUES");return {pages:doc.getPageCount(),mode,font:"Georgia Bold",evidenceClass:"DOWNLOADED_DOCUMENT_BYTES"};
}
