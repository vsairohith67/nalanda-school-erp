import {Readable} from "node:stream";
import {expect,it} from "vitest";
import {assertProjectedUpload,downloadBytes} from "../scripts/portable/integrated-browser";
it("checks the actual captured request projection and refuses a private field even without its sentinel",()=>{
 const body={action:"preview",rows:[{admissionNo:"SYNTHETIC",studentName:"SYNTHETIC",academicYear:"2026-27",className:"I"}]};
 expect(assertProjectedUpload(JSON.stringify(body))).toBe("preview");
 expect(()=>assertProjectedUpload(JSON.stringify({...body,rows:[{...body.rows[0],PrivateBalance:"hidden"}]}))).toThrow("UNAPPROVED_UPLOAD_FIELD");
 expect(()=>assertProjectedUpload(JSON.stringify({...body,rows:[{...body.rows[0],studentName:"FORBIDDEN_BROWSER_SENTINEL"}]}))).toThrow();
 expect(()=>assertProjectedUpload(JSON.stringify({...body,rows:[]}))).toThrow();
});
it("inspects downloaded stream bytes and refuses interrupted or oversized downloads",async()=>{
 const bytes=Buffer.from("admissionNo,studentName\r\nSYNTHETIC,SYNTHETIC\r\n");
 expect(await downloadBytes({createReadStream:async()=>Readable.from([bytes.subarray(0,8),bytes.subarray(8)]),failure:async()=>null})).toEqual(bytes);
 await expect(downloadBytes({createReadStream:async()=>Readable.from([bytes]),failure:async()=>"cancelled"})).rejects.toThrow();
 await expect(downloadBytes({createReadStream:async()=>Readable.from([Buffer.alloc(16*1024*1024+1)]),failure:async()=>null})).rejects.toThrow();
});
