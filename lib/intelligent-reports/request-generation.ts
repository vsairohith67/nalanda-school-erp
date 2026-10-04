/** No result cache. Invalidating synchronously prevents late async work from rendering. */
export class RequestGeneration {
  private generation=0;
  private controller:AbortController|null=null;
  invalidate(){this.generation++;this.controller?.abort();this.controller=null;}
  begin(){this.invalidate();this.controller=new AbortController();return {generation:this.generation,signal:this.controller.signal};}
  current(generation:number){return generation===this.generation;}
}
