param([Parameter(Mandatory=$true)][string]$Cases,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$case=Get-Content -LiteralPath $Cases -Raw | ConvertFrom-Json
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$principal=[Security.Principal.WindowsPrincipal]::new($identity)
if ($identity.User.Value -ne $case.userSid -or $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) -or 'S-1-5-32-544' -in @($identity.Groups | ForEach-Object Value)) {throw 'ISOLATION_GENUINE_STANDARD_TOKEN_REQUIRED'}
$deadline=(Get-Date).AddSeconds(30)
while(-not (Test-Path -LiteralPath $case.startGate)) {if((Get-Date) -ge $deadline){throw 'ISOLATION_JOB_ASSIGNMENT_GATE_TIMEOUT'};Start-Sleep -Milliseconds 50}
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class BiometricFileProbe {
    public static int Rename(string source,string destination) {return MoveFileExW(source,destination,0) ? 0 : Marshal.GetLastWin32Error();}
    public static int Dacl(string path,byte[] descriptor) {
        var p=Marshal.AllocHGlobal(descriptor.Length);
        try {Marshal.Copy(descriptor,0,p,descriptor.Length);bool present,defaults;System.IntPtr acl;
            if(!GetSecurityDescriptorDacl(p,out present,out acl,out defaults))return Marshal.GetLastWin32Error();
            if(!present || acl==System.IntPtr.Zero)return 1338;
            return (int)SetNamedSecurityInfoW(path,1,0x80000004u,System.IntPtr.Zero,System.IntPtr.Zero,acl,System.IntPtr.Zero);
        } finally {Marshal.FreeHGlobal(p);}
    }
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,ExactSpelling=true,SetLastError=true)] static extern bool MoveFileExW(string source,string destination,uint flags);
    [DllImport("advapi32.dll",ExactSpelling=true,SetLastError=true)] static extern bool GetSecurityDescriptorDacl(System.IntPtr descriptor,out bool present,out System.IntPtr acl,out bool defaults);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,ExactSpelling=true)] static extern uint SetNamedSecurityInfoW(string path,int kind,uint information,System.IntPtr owner,System.IntPtr group,System.IntPtr acl,System.IntPtr sacl);
}
'@
$results=[ordered]@{genuineStandardToken=$true}
function Native-Denied([string]$Label,[int]$Code) {if($Code -ne 5){throw "ISOLATION_NATIVE_NOT_ACCESS_DENIED:${Label}:W$Code"};$results[$Label]=$true}
function Test-Dacl([bool]$Directory) {
  $acl=if($Directory){[Security.AccessControl.DirectorySecurity]::new()}else{[Security.AccessControl.FileSecurity]::new()}
  $acl.SetAccessRuleProtection($true,$false)
  foreach($sid in @($identity.User.Value,'S-1-5-18','S-1-5-32-544')){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))}
  return ,$acl.GetSecurityDescriptorBinaryForm()
}
function Denied([string]$Label,[scriptblock]$Operation) {
  try { & $Operation | Out-Null; throw "ISOLATION_UNEXPECTED_ACCESS:$Label" }
  catch {
    $e=$_.Exception; $accessDenied=$false;$codes=[Collections.Generic.List[string]]::new()
    while ($e) {
      $codes.Add(('H'+$e.HResult.ToString('X8')))
      if ($e -is [ComponentModel.Win32Exception]) {$codes.Add(('W'+$e.NativeErrorCode))}
      if ($e -is [UnauthorizedAccessException] -or ($e.HResult -band 0xffff) -eq 5 -or ($e -is [ComponentModel.Win32Exception] -and $e.NativeErrorCode -eq 5)) {$accessDenied=$true};$e=$e.InnerException
    }
    if (-not $accessDenied) {throw ('ISOLATION_NOT_ACCESS_DENIED:'+${Label}+':'+($codes -join '_'))}
    $results[$Label]=$true
  }
}
function Sc-Denied([string]$Label,[string[]]$Arguments) {
  & $case.sc @Arguments *> $null
  if ($LASTEXITCODE -ne 5) {throw "ISOLATION_SCM_NOT_ACCESS_DENIED:$Label"}
  $results[$Label]=$true
}
Denied 'secretRead' {[IO.File]::ReadAllBytes($case.secret)}
Denied 'queueRead' {[IO.File]::ReadAllBytes($case.queue)}
foreach ($item in $case.replaceFiles) {
  Denied ('replace_'+$item.label) {[IO.File]::WriteAllText($item.path,'unauthorised')}
  Native-Denied ('rename_'+$item.label) ([BiometricFileProbe]::Rename($item.path,$item.path+'.unauthorised'))
}
foreach ($item in $case.configFiles) {Denied ('configuration_'+$item.label) {[IO.File]::WriteAllText($item.path,'{}')}}
foreach ($item in $case.aclPaths) {
  Native-Denied ('permissions_'+$item.label) ([BiometricFileProbe]::Dacl($item.path,(Test-Dacl $item.directory)))
}
foreach ($item in $case.renameDirectories) {
  Native-Denied ('directoryRename_'+$item.label) ([BiometricFileProbe]::Rename($item.path,$item.path+'.unauthorised'))
  Denied ('directoryCreate_'+$item.label) {[IO.Directory]::CreateDirectory((Join-Path $item.path 'unauthorised'))}
}
Sc-Denied 'serviceCommandLine' @('config',$case.name,'binPath=',$case.binary)
Sc-Denied 'serviceIdentity' @('config',$case.name,'obj=',("NT SERVICE\"+$case.name))
Sc-Denied 'serviceStart' @('start',$case.name)
Sc-Denied 'serviceStop' @('stop',$case.name)
Denied 'serviceRestart' {Restart-Service -Name $case.name -Force}
Sc-Denied 'serviceReconfigure' @('failure',$case.name,'reset=','0','actions=','restart/1000')
Sc-Denied 'servicePermissions' @('sdset',$case.name,'D:(A;;GA;;;WD)')
Denied 'serviceProcessTermination' {Stop-Process -Id $case.servicePid -Force}
Denied 'workerProcessTermination' {Stop-Process -Id $case.workerPid -Force}
Denied 'directPrivilegedRecovery' {Start-Process -FilePath $case.host -ArgumentList @('--resume',('"'+$case.privateHostConfig+'"')) -PassThru -Wait}
foreach ($action in @('Restart','Resume')) {
  # Public nonsensitive config lets the caller reach the actual administrative guard.
  $administrationError=& $case.pwsh -NoProfile -NonInteractive -File $case.management -Action $action -HostConfig $case.publicHostConfig -Apply -TargetComputer $env:COMPUTERNAME -ConfirmApply ("APPLY:"+$env:COMPUTERNAME) 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0 -or $administrationError -notmatch 'COMPANION_ADMIN_REQUIRED') {throw "ISOLATION_ADMINISTRATION_GUARD_NOT_PROVEN:$action"}
  $results['administration_'+$action]=$true
}
# Positive controls: usable token/filesystem, public read-only health/report, and
# readable machine-scope DPAPI control. DPAPI itself is deliberately not the ACL.
$scratch=Join-Path (Split-Path -Parent $Output) 'positive.txt'
[IO.File]::WriteAllText($scratch,'synthetic')
if ([IO.File]::ReadAllText($scratch) -ne 'synthetic') {throw 'ISOLATION_SCRATCH_CONTROL_FAILED'}
$results.scratchReadWrite=$true
if([BiometricFileProbe]::Rename($scratch,$scratch+'.renamed') -ne 0 -or [IO.File]::ReadAllText($scratch+'.renamed') -ne 'synthetic'){throw 'ISOLATION_NATIVE_RENAME_CONTROL_FAILED'}
if([BiometricFileProbe]::Dacl($scratch+'.renamed',(Test-Dacl $false)) -ne 0){throw 'ISOLATION_NATIVE_DACL_CONTROL_FAILED'}
$results.nativeRenameDaclPositiveControls=$true
foreach ($item in @($case.health,$case.report)) {
  if ([IO.File]::ReadAllText($item).Length -lt 1) {throw 'ISOLATION_PUBLIC_READ_CONTROL_FAILED'}
  $label=if($item -eq $case.health){'publicWrite_health'}else{'publicWrite_report'}
  Denied $label {[IO.File]::WriteAllText($item,'unauthorised')}
}
$results.approvedHealthReportRead=$true
Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
$plain=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($case.dpapiControl),$null,[Security.Cryptography.DataProtectionScope]::LocalMachine)
if ($plain.Length -ne 32) {throw 'ISOLATION_DPAPI_CONTROL_FAILED'}
[Security.Cryptography.CryptographicOperations]::ZeroMemory($plain)
$results.machineDpapiReadableControl=$true
$results | ConvertTo-Json | Set-Content -LiteralPath $Output
