export function ciProject(env:Record<string,string|undefined>){
 if(!/^\d+$/.test(env.GITHUB_RUN_ID??"")||!/^\d+$/.test(env.GITHUB_RUN_ATTEMPT??""))throw Error("CI_RUN_IDENTITY_REQUIRED");
 const phase=env.PORTABLE_ACCEPTANCE_PHASE??"production-OFF";
 if(phase!=="production-OFF"&&phase!=="synthetic-ON")throw Error("CI_PHASE_INVALID");
 return `nalanda-ci-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}-${phase==="synthetic-ON"?"qaon":"stack"}`;
}
