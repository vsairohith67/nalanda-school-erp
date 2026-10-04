import {it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,existsSync,mkdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';

// Execute the REAL helper's validation with controlled OS metadata functions.
// No production registration, real ACL changes, directory creation or claim.
// This proves refusal logic, not actual Windows custody/durability approval.
const windows=it.skipIf(process.platform!=='win32');
windows.each(['valid-inspection','foreign-sid','exfat','remote-drive','wrong-volume','reparse','foreign-owner','wide-acl','unprotected','missing-inheritance','replay','bad-receipt','valid-verification'])('real custody helper under controlled metadata: %s',testCase=>{
 const root=path.join(process.cwd(),'tmp');if(!existsSync(root))mkdirSync(root);const dir=mkdtempSync(path.join(root,'a4-custody-test-')),wrapper=path.join(dir,'controlled.ps1');
 const helper=path.join(process.cwd(),'scripts/laptop-lab/consumer-custody.ps1');
 const script=`$ErrorActionPreference='Stop'
# Initialize native metadata before the controlled OS functions can affect autoload.
try {
 Import-Module -Name ([IO.Path]::Combine($PSHOME,'Modules','Microsoft.PowerShell.Security','Microsoft.PowerShell.Security.psd1')) -ErrorAction Stop
 $metadata=[ordered]@{executable=[Diagnostics.Process]::GetCurrentProcess().MainModule.FileName;version=$PSVersionTable.PSVersion.ToString();is64Bit=[Environment]::Is64BitProcess;languageMode=$ExecutionContext.SessionState.LanguageMode.ToString();effectivePolicy=(Microsoft.PowerShell.Security\\Get-ExecutionPolicy).ToString()}
 [IO.File]::WriteAllText('${path.join(dir,'helper-process.json').replaceAll("'","''")}',($metadata|ConvertTo-Json -Compress))
} catch {
 $failure=[ordered]@{stage='NATIVE_SECURITY_INITIALIZATION';errorId=([string]$_.FullyQualifiedErrorId).Substring(0,[Math]::Min(160,([string]$_.FullyQualifiedErrorId).Length));exceptionType=$_.Exception.GetType().FullName}
 [IO.File]::WriteAllText('${path.join(dir,'initialization-failure.json').replaceAll("'","''")}',($failure|ConvertTo-Json -Compress))
 [Console]::Error.WriteLine('CUSTODY_FIXTURE_INITIALIZATION_FAILED')
 exit 1
}
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
& '${helper.replaceAll("'","''")}'
# -File does not propagate a nested script's exit. Preserve the REAL helper exit.
exit $LASTEXITCODE
`;
 writeFileSync(wrapper,script,{flag:'wx'});
 const request={operation:testCase.includes('verification')||testCase==='bad-receipt'?'verify':'inspect',custody:{directory:'C:\\SYNTHETIC-A4-'+randomUUID(),userSid:'S-1-5-21-100-200-300-400',volumeSerial:'ABCDEF12',kind:'WINDOWS_NTFS_LOCAL_V1'},claimKey:'a'.repeat(64),authorizationSha256:'b'.repeat(64),authorizationName:'authorization-'+'c'.repeat(32)+'.json',endorsementName:'endorsement-123-1.json'};
 // Match the selected Desktop interpreter's native modules instead of the
 // caller's PowerShellCore module path. Preserve the inherited execution policy.
 let output='',error='',exit:number|null=0;try{output=execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-File',wrapper],{input:JSON.stringify({name:testCase,request}),env:{...process.env,PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'},encoding:'utf8',windowsHide:true,timeout:10000,stdio:'pipe'});}catch(e:any){error=e.stderr?.toString()??'FAILED';exit=e.status??null;}
 const sha=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
 writeFileSync(path.join(dir,'helper-execution.json'),JSON.stringify({case:testCase,helperSha256:sha(helper),wrapperSha256:sha(wrapper),expectedExit:testCase.startsWith('valid-')?0:1,actualExit:exit,stdoutContract:output?JSON.parse(output).contract:null,helperRefusal:error.includes('LOCAL_CUSTODY_REFUSED'),processMetadata:existsSync(path.join(dir,'helper-process.json'))?JSON.parse(readFileSync(path.join(dir,'helper-process.json'),'utf8')):null}),{flag:'wx'});
 expect(existsSync(path.join(dir,'initialization-failure.json'))).toBe(false);
 expect(existsSync(path.join(dir,'helper-process.json'))).toBe(true);
 expect(exit).toBe(testCase.startsWith('valid-')?0:1);
 if(testCase.startsWith('valid-')){expect(error).toBe('');expect(JSON.parse(output).contract).toBe('NALANDA_LOCAL_CUSTODY_CHECK_V1');}else expect(error).toContain('LOCAL_CUSTODY_REFUSED');
 expect(existsSync(request.custody.directory)).toBe(false);
});
