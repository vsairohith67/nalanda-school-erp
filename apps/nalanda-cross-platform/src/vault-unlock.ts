/** Cancellation boundary around existing vault/storage operations. No new
 * storage or authentication policy: a lock/background invalidates pending UI
 * publication, and a discarded session is unloaded through its normal lock. */
export async function completeVaultUnlock<S extends {lock():Promise<void>},R>(input:{open:()=>Promise<S|null>;read:(session:S)=>Promise<R>;current:()=>boolean;publish:(session:S,value:R)=>void}){
 const session=await input.open();if(!session)throw Error("Native secret storage is unavailable.");
 try{
  if(!input.current())throw Error("VAULT_UNLOCK_CANCELLED");
  const value=await input.read(session);
  if(!input.current())throw Error("VAULT_UNLOCK_CANCELLED");
  input.publish(session,value);
 }catch(error){await session.lock();throw error;}
}
