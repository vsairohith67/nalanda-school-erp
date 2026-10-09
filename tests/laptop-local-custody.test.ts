import {it,expect,onTestFinished} from 'vitest';
import {mkdtempSync,writeFileSync,existsSync,mkdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {configuredQaTrace,custodyCases,QaTrace} from './helpers/qa-reliability';
import {atomicPrivateJson,captureCustodyChild,custodyStartupScript,readCustodyStages} from './helpers/custody-execution';

// Execute the REAL helper's validation with controlled OS metadata functions.
// No production registration, real ACL changes, directory creation or claim.
// This proves refusal logic, not actual Windows custody/durability approval.
const windows=it.skipIf(process.platform!=='win32');
windows.each(custodyCases)('real custody helper under controlled metadata: %s',testCase=>{
 const configured=configuredQaTrace('custody',testCase);
 const root=path.join(process.cwd(),'tmp');if(!existsSync(root))mkdirSync(root);const dir=configured.directory??mkdtempSync(path.join(root,'a4-custody-test-')),wrapper=path.join(dir,'controlled.ps1');
 const trace=configured.directory?configured:new QaTrace('custody',testCase,dir);
 onTestFinished(({task})=>trace.finish(task.result?.state==='pass'?'PASS':task.result?.state==='fail'?'FAIL':'UNKNOWN'));
 const fixture=trace.begin('fixture-create');
 const helper=path.join(process.cwd(),'scripts/laptop-lab/consumer-custody.ps1');
 const script=custodyStartupScript(dir)+`
$global:a4Case=[Console]::In.ReadToEnd()|ConvertFrom-Json
$global:a4Sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$r=$global:a4Case.request
if($global:a4Case.name -ne 'foreign-sid'){$r.custody.userSid=$global:a4Sid}
function Get-CimInstance { param($ClassName,$Filter)
 return [pscustomobject]@{DriveType=$(if($global:a4Case.name -eq 'remote-drive'){4}else{3});FileSystem=$(if($global:a4Case.name -eq 'exfat'){'exFAT'}else{'NTFS'});VolumeSerialNumber=$(if($global:a4Case.name -eq 'wrong-volume'){'00000000'}else{'ABCDEF12'})}
}
function Get-Item {param([switch]$Force,$LiteralPath)
 return [pscustomobject]@{PSIsContainer=(!$LiteralPath.EndsWith('.json'));Attributes=$(if($global:a4Case.name -eq 'reparse'){[IO.FileAttributes]::ReparsePoint}else{[IO.FileAttributes]::Normal});Length=150}
}
function Get-Acl {param($LiteralPath)
 $acl=[pscustomobject]@{AreAccessRulesProtected=($global:a4Case.name -ne 'unprotected')}
 $acl|Add-Member ScriptMethod GetOwner {param($type) return [pscustomobject]@{Value=$(if($global:a4Case.name -eq 'foreign-owner'){'S-1-5-18'}else{$global:a4Sid})}}
 $acl|Add-Member ScriptMethod GetAccessRules {param($explicit,$inherited,$type)
  $ids=@($global:a4Sid,'S-1-5-18');if($global:a4Case.name -eq 'wide-acl'){$ids+= 'S-1-1-0'}
  return @($ids|ForEach-Object {[pscustomobject]@{IdentityReference=[pscustomobject]@{Value=$_};AccessControlType='Allow';FileSystemRights=[Security.AccessControl.FileSystemRights]::FullControl;InheritanceFlags=$(if($global:a4Case.name -eq 'missing-inheritance'){0}else{3});PropagationFlags=0}})
 };return $acl
}
function Test-Path {param($LiteralPath) return ($global:a4Case.name -eq 'replay')}
function Get-ChildItem {param($LiteralPath,[switch]$Force,[switch]$Recurse) return @()}
function Get-Content {param($LiteralPath,[switch]$Raw)
 return (@{contract='NALANDA_LOCAL_RUNTIME_CONSUMED_V1';claimKey=$global:a4Case.request.claimKey;authorizationSha256=$(if($global:a4Case.name -eq 'bad-receipt'){'bad'}else{$global:a4Case.request.authorizationSha256})}|ConvertTo-Json -Compress)
}
[Console]::SetIn([IO.StringReader]::new(($r|ConvertTo-Json -Depth 5 -Compress)))
Write-A4Stage 'helper-entry.json' 'HELPER_ENTRY'
& '${helper.replaceAll("'","''")}'
# -File does not propagate a nested script's exit. Preserve the REAL helper exit.
$helperExit=$LASTEXITCODE
Write-A4Stage 'helper-exit.json' 'HELPER_EXIT' $helperExit
exit $helperExit
`;
 writeFileSync(wrapper,script,{flag:'wx',mode:0o600});
 const sha=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
 const digests={helperSha256:sha(helper),wrapperSha256:sha(wrapper)};trace.bind(digests);trace.end(fixture);
 const request={operation:testCase.includes('verification')||testCase==='bad-receipt'?'verify':'inspect',custody:{directory:'C:\\SYNTHETIC-A4-'+randomUUID(),userSid:'S-1-5-21-100-200-300-400',volumeSerial:'ABCDEF12',kind:'WINDOWS_NTFS_LOCAL_V1'},claimKey:'a'.repeat(64),authorizationSha256:'b'.repeat(64),authorizationName:'authorization-'+'c'.repeat(32)+'.json',endorsementName:'endorsement-123-1.json'};
 // Match the selected Desktop interpreter's native modules instead of the
 // caller's PowerShellCore module path. Preserve the inherited execution policy.
 const child=captureCustodyChild({command:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',args:['-NoProfile','-NonInteractive','-File',wrapper],input:JSON.stringify({name:testCase,request}),env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'},directory:dir,trace,mode:'REAL_HELPER_CONTROLLED_METADATA',timeoutMs:10000});
 const parent=trace.begin('parent-finalize'),stages=readCustodyStages(dir);
 atomicPrivateJson(path.join(dir,'helper-execution.json'),{case:testCase,...digests,expectedExit:testCase.startsWith('valid-')?0:1,actualExit:child.process.exit,stdoutState:child.output.state,stdoutContract:child.output.value?.contract??null,helperRefusal:child.stderr.includes('LOCAL_CUSTODY_REFUSED'),processMetadataState:child.metadata.state,processMetadata:child.metadata.value,stages});
 let passed=false;try{
 expect(child.evidenceComplete).toBe(true);
 expect(existsSync(path.join(dir,'initialization-failure.json'))).toBe(false);
 expect(existsSync(path.join(dir,'helper-process.json'))).toBe(true);
 expect(child.nativeMetadataValid).toBe(true);
 expect(child.metadata.value?.executable?.toString().toLowerCase()).toBe('c:\\windows\\system32\\windowspowershell\\v1.0\\powershell.exe');
 expect(child.metadata.value?.is64Bit).toBe(true);
 expect(stages.every(stage=>stage.state==='VALID')).toBe(true);
 // A successful PowerShell script need not set LASTEXITCODE. Its observed null
 // stays null; actual wrapper exit comes only from the parent's child result.
 if(stages.at(-1)?.exit!==null)expect(stages.at(-1)?.exit).toBe(child.process.exit);
 expect(child.process.exit).toBe(testCase.startsWith('valid-')?0:1);
 if(testCase.startsWith('valid-')){expect(child.stderr).toBe('');expect(child.output.state).toBe('VALID');expect(child.output.value?.contract).toBe('NALANDA_LOCAL_CUSTODY_CHECK_V1');}else expect(child.stderr).toContain('LOCAL_CUSTODY_REFUSED');
 expect(existsSync(request.custody.directory)).toBe(false);
 passed=true;}finally{trace.end(parent,passed?'PASS':'FAIL');}
 // Retain the owned fixture and private child diagnostics. UNKNOWN descendant
 // settlement never authorizes removal, and these files are never CI uploads.
});
