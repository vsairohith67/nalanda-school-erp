import assert from 'node:assert/strict';
/** Called inside the same serializable transaction as the existing initializer.
 * Lock all application tables before counting; migration history is not data. */
export async function proveEmptySyntheticTables(query:(sql:string)=>Promise<unknown>,execute:(sql:string)=>Promise<unknown>){
 const tables=await query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY tablename");
 assert(Array.isArray(tables)&&tables.length>0&&tables.length<=1024,'SYNTHETIC_EMPTY_DATABASE_TABLES_REQUIRED');
 const names=tables.map(row=>{assert(row&&typeof row==='object'&&typeof row.tablename==='string'&&/^[A-Za-z][A-Za-z0-9_]*$/.test(row.tablename),'SYNTHETIC_EMPTY_DATABASE_TABLE_INVALID');return 'public."'+row.tablename+'"';});
 assert(new Set(names).size===names.length,'SYNTHETIC_EMPTY_DATABASE_TABLE_INVALID');
 await execute('LOCK TABLE '+names.join(',')+' IN SHARE ROW EXCLUSIVE MODE');
 for(const name of names){const count=await query('SELECT count(*) AS count FROM '+name);assert(Array.isArray(count)&&count.length===1&&count[0].count===0n,'SYNTHETIC_DATABASE_NOT_EMPTY');}
}
