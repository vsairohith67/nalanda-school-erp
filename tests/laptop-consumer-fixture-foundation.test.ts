import {it,expect,vi} from 'vitest';
import {proveEmptySyntheticTables} from '../scripts/laptop-lab/consumer-fixture-foundation';
it('locks every sorted application table before counting an empty fresh database',async()=>{
 const calls:string[]=[];const query=async(sql:string)=>{calls.push(sql);return sql.startsWith('SELECT tablename')?[{tablename:'Student'},{tablename:'User'}]:[{count:0n}];};
 await proveEmptySyntheticTables(query,async sql=>{calls.push(sql);return 0;});
 expect(calls).toEqual(["SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY tablename",'LOCK TABLE public."Student",public."User" IN SHARE ROW EXCLUSIVE MODE','SELECT count(*) AS count FROM public."Student"','SELECT count(*) AS count FROM public."User"']);
});
it.each([1n,800n,0,'0',null])('refuses any populated or unproved application table count %s',async count=>{
 const initialize=vi.fn();const query=async(sql:string)=>sql.startsWith('SELECT tablename')?[{tablename:'Payment'}]:[{count}];
 await expect(proveEmptySyntheticTables(query,async()=>0).then(initialize)).rejects.toThrow('SYNTHETIC_DATABASE_NOT_EMPTY');expect(initialize).not.toHaveBeenCalled();
});
it.each([[],[{tablename:'User";DELETE'}],[{tablename:'User'},{tablename:'User'}],Array(1025).fill({tablename:'User'})])('refuses unsafe or incomplete table inventory before taking locks',async tables=>{
 const execute=vi.fn();await expect(proveEmptySyntheticTables(async()=>tables,execute)).rejects.toThrow();expect(execute).not.toHaveBeenCalled();
});
it('does not proceed after a lock failure',async()=>{
 const query=vi.fn(async()=>[{tablename:'SchoolSettings'}]);await expect(proveEmptySyntheticTables(query,async()=>{throw Error('LOCK_DENIED');})).rejects.toThrow('LOCK_DENIED');expect(query).toHaveBeenCalledTimes(1);
});
