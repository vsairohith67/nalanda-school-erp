import {beforeEach,describe,it,expect,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {hashBytes} from '../scripts/portable/artifact-handoff';
const port=vi.hoisted(()=>({lookup:vi.fn(),request:vi.fn()}));
vi.mock('node:dns/promises',()=>({lookup:port.lookup}));
vi.mock('node:https',()=>({request:port.request}));
import {downloadMaterialBytes} from '../scripts/portable/material-download';
// HARNESS_ONLY transport; no socket or external traffic. Decisions use the
// actual downloader before and after this finite response boundary.
describe('material downloader enforced transport boundary',()=>{
 const raw=Buffer.from('TEST ONLY bytes'),url='https://registry.npmjs.org/fixture';
 beforeEach(()=>{vi.resetAllMocks();port.lookup.mockResolvedValue([{address:'104.16.31.34',family:4}]);});
 const response=(status=200,bytes=raw,headers={})=>port.request.mockImplementation((_url,options,callback)=>{const req:any=new EventEmitter();let stopped=false;req.destroy=(error:Error)=>{if(!stopped){stopped=true;req.emit('error',error);}return req;};req.end=()=>queueMicrotask(()=>{const res:any=Readable.from([bytes]);res.statusCode=status;res.headers=headers;callback(res);});return req;});
 it('refuses private DNS before any HTTPS request',async()=>{port.lookup.mockResolvedValue([{address:'169.254.169.254',family:4}]);await expect(downloadMaterialBytes(url,hashBytes(raw),raw.length)).rejects.toThrow('MATERIAL_DOWNLOAD_ADDRESS_REFUSED');expect(port.request).not.toHaveBeenCalled();});
 it('pins public lookup, TLS CA and expected bytes',async()=>{response();expect(await downloadMaterialBytes(url,hashBytes(raw),raw.length)).toEqual(raw);const options=port.request.mock.calls[0][1];expect(options.agent).toBe(false);expect(options.servername).toBe('registry.npmjs.org');expect(options.ca.length).toBeGreaterThan(1);const cb=vi.fn();options.lookup('registry.npmjs.org',{all:true},cb);expect(cb).toHaveBeenCalledWith(null,[{address:'104.16.31.34',family:4}],4);});
 it('never follows a redirect, including to metadata IP',async()=>{response(302,Buffer.alloc(0),{location:'http://169.254.169.254/'});await expect(downloadMaterialBytes(url,hashBytes(raw),raw.length)).rejects.toThrow();expect(port.request).toHaveBeenCalledTimes(1);});
 it.each(['truncated','substituted','overlong'])('refuses %s transfer',kind=>{response(200,kind==='truncated'?raw.subarray(1):kind==='overlong'?Buffer.concat([raw,raw]):Buffer.alloc(raw.length));return expect(downloadMaterialBytes(url,hashBytes(raw),raw.length)).rejects.toThrow();});
});
