param([Parameter(Mandatory=$true)][string]$HostExe,[Parameter(Mandatory=$true)][string]$BridgeRoot)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
# This boundary must precede every account, service and filesystem mutation.
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {throw 'ISOLATION_REQUIRES_ADMITTED_DISPOSABLE_GITHUB_RUNNER'}
$principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {throw 'ISOLATION_RUNNER_ADMIN_REQUIRED'}
$suffix=$env:GITHUB_RUN_ID+'_'+$env:GITHUB_RUN_ATTEMPT
$name='NalandaBiometricIso'+$suffix
$user='Nbc'+$suffix
if ($user.Length -gt 20 -or $suffix -notmatch '^\d+_\d+$') {throw 'ISOLATION_UNIQUE_NAME_INVALID'}
$binParent=Join-Path $env:ProgramFiles $name
$dataParent=Join-Path $env:ProgramData $name
$public=Join-Path $env:RUNNER_TEMP ($name+'Public')
$scratch=Join-Path $env:RUNNER_TEMP ($name+'Scratch')
$roots=@($binParent,$dataParent,$public,$scratch)
$renameRoots=@(($binParent+'.unauthorised'),($dataParent+'.unauthorised'))
foreach ($root in ($roots+$renameRoots)) {if(Test-Path -LiteralPath $root){throw 'ISOLATION_FIXTURE_ALREADY_EXISTS'}}
if ((Get-Service $name -ErrorAction SilentlyContinue) -or (Get-LocalUser $user -ErrorAction SilentlyContinue)) {throw 'ISOLATION_IDENTITY_ALREADY_EXISTS'}
$sc="$env:SystemRoot\System32\sc.exe"
$pwsh=(Get-Command pwsh.exe).Source
$registered=$false;$createdUser=$false;$probe=$null;$probeJob=$null;$userSid=$null;$failure=$null
Add-Type -Path (Join-Path $PSScriptRoot 'probe-job.cs')
Import-Module (Join-Path $BridgeRoot 'windows/security.psm1') -Force
function Checked([string[]]$Arguments) {& $sc @Arguments | Out-Null;if($LASTEXITCODE -ne 0){throw "ISOLATION_SCM_FAILED:$LASTEXITCODE"}}
function Fixture-Acl([string]$Directory,[string]$Identity,[string]$Rights) {Private-Acl $Directory $Identity $Rights}
function Owned-Children { @(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $node -and $_.CommandLine -like "*$config*"}) }
function Wait-Healthy([datetime]$Since) {
  $deadline=(Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $health) {
      try {$h=Get-Content -LiteralPath $health -Raw | ConvertFrom-Json
        if($h.status -eq 'HEALTHY' -and $h.processRunning -and $h.lastPollAt -and ([datetime]$h.lastPollAt).ToUniversalTime() -ge $Since -and ([datetime]$h.updatedAt).ToUniversalTime() -ge $Since -and $h.queueDepth -gt 0 -and -not $h.adapterUnavailable -and @(Owned-Children).Count -eq 1){return}
      } catch { }
    }
    Start-Sleep -Milliseconds 100
  }
  throw 'ISOLATION_FRESH_POLL_REQUIRED'
}
function Json-File($Object,[string]$Path) {$Object | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding utf8}
try {
  foreach($root in $roots){New-Item -ItemType Directory -Path $root | Out-Null}
  $bin=Join-Path $binParent 'package';$private=Join-Path $dataParent 'private';$runtime=Join-Path $private 'runtime';$admin=Join-Path $dataParent 'admin'
  foreach($d in @($bin,$private,$runtime,$admin)){New-Item -ItemType Directory -Path $d | Out-Null}
  Copy-Item -LiteralPath (Split-Path -Parent $HostExe) -Destination (Join-Path $bin 'host') -Recurse
  Copy-Item -LiteralPath (Join-Path $BridgeRoot 'dist') -Destination (Join-Path $bin 'dist') -Recurse
  Copy-Item -LiteralPath (Get-Command node.exe).Source -Destination (Join-Path $bin 'node.exe')
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'service-isolation-probe.mjs') -Destination (Join-Path $bin 'service-probe.mjs')
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'standard-account-probe.ps1') -Destination (Join-Path $public 'probe.ps1')
  foreach($file in @('companion.ps1','security.psm1')){Copy-Item -LiteralPath (Join-Path $BridgeRoot ('windows/'+$file)) -Destination (Join-Path $public $file)}
  $hostPath=Join-Path $bin 'host/Nalanda.Biometric.Service.exe'
  $node=Join-Path $bin 'node.exe';$agent=Join-Path $bin 'service-probe.mjs';$worker=Join-Path $bin 'dist/agent.js';$native=Join-Path $bin 'host/coreclr.dll'
  $config=Join-Path $private 'bridge.json';$hostConfig=Join-Path $private 'host.json';$secret=Join-Path $private 'secret.dpapi';$health=Join-Path $runtime 'health.json';$queue=Join-Path $runtime 'queue.enc';$rights=Join-Path $runtime 'service-rights.json'
  $adminOnly=Join-Path $admin 'maintenance.json';'{}' | Set-Content -LiteralPath $adminOnly
  Json-File @{bridgeId='00000000-0000-4000-8000-000000000001';erpUrl='https://erp.example.invalid';privateKeyPath='unused.jwk';queuePath='runtime/queue.enc';healthPath='runtime/health.json';pollIntervalMs=60000;transportEnabled=$false;syntheticOnly=$true;devices=@(@{deviceId='00000000-0000-4000-8000-000000000002';host='127.0.0.1';port=1;profile='SIMULATOR'})} $config
  $settings=@{serviceName=$name;nodeExe=$node;agentPath=$agent;bridgeConfig=$config;secretPath=$secret;workingDirectory=$bin;nodeSha256=(Get-FileHash -LiteralPath $node).Hash;agentSha256=(Get-FileHash -LiteralPath $agent).Hash;startupMs=10000;stopMs=3000;maxRestarts=2}
  Json-File $settings $hostConfig
  Json-File $settings (Join-Path $public 'host.json')
  $rng=[byte[]]::new(32);[Security.Cryptography.RandomNumberGenerator]::Fill($rng)
  $secrets=@{queueKey=([Convert]::ToBase64String($rng)).TrimEnd('=').Replace('+','-').Replace('/','_');keyVersion=1} | ConvertTo-Json -Compress
  $secrets | & $hostPath --provision $secret | Out-Null
  if($LASTEXITCODE -ne 0){throw 'ISOLATION_SECRET_PROVISION_FAILED'}
  [Security.Cryptography.CryptographicOperations]::ZeroMemory($rng)
  $binary='"'+$hostPath+'" --service "'+$hostConfig+'"'
  Checked @('create',$name,'binPath=',$binary,'start=','demand','obj=',("NT SERVICE\"+$name));$registered=$true
  Checked @('sidtype',$name,'unrestricted');Protect-CompanionService $name
  $sid=[Security.Principal.NTAccount]::new("NT SERVICE\$name").Translate([Security.Principal.SecurityIdentifier]).Value
  Json-File @{sid=$sid;whoami="$env:SystemRoot\System32\whoami.exe";secret=$secret;worker=$worker;adminOnly=$adminOnly;results=$rights} (Join-Path $bin 'service-probe.json')
  Json-File @{task='BIOMETRIC-DESKTOP-COMPANION-1A';serviceName=$name;currentBinary=$binary;previousBinary=$null;hostConfig=$hostConfig} (Join-Path $private 'companion-ownership.json')
  # Use exactly the production directory/service policy, including protected ancestors.
  Fixture-Acl $binParent $sid 'ReadAndExecute';Fixture-Acl $dataParent $sid 'ReadAndExecute'
  Fixture-Acl $bin $sid 'ReadAndExecute';Fixture-Acl $private $sid 'ReadAndExecute';Fixture-Acl $runtime $sid 'Modify'
  Fixture-Acl $admin 'S-1-5-18' 'FullControl'
  $since=(Get-Date).ToUniversalTime();Start-Service $name
  (Get-Service $name).WaitForStatus('Running',[TimeSpan]::FromSeconds(20));Wait-Healthy $since
  $serviceRights=Get-Content -LiteralPath $rights -Raw | ConvertFrom-Json
  if(@($serviceRights.PSObject.Properties | Where-Object Value -ne $true).Count -ne 0){throw 'ISOLATION_SERVICE_IDENTITY_CONTROL_FAILED'}
  $encrypted=Get-Content -LiteralPath $queue -Raw | ConvertFrom-Json
  if($encrypted.version -ne 1 -or -not $encrypted.iv -or -not $encrypted.tag -or -not $encrypted.ciphertext -or 'events' -in $encrypted.PSObject.Properties.Name){throw 'ISOLATION_ENCRYPTED_QUEUE_REQUIRED'}
  # Synthetic public control bytes are never the protected queue credential.
  Add-Type -AssemblyName System.Security.Cryptography.ProtectedData
  $control=[byte[]]::new(32);[Security.Cryptography.RandomNumberGenerator]::Fill($control)
  [IO.File]::WriteAllBytes((Join-Path $public 'dpapi-control.bin'),[Security.Cryptography.ProtectedData]::Protect($control,$null,[Security.Cryptography.DataProtectionScope]::LocalMachine))
  [Security.Cryptography.CryptographicOperations]::ZeroMemory($control)
  Json-File @{status='HEALTHY';processRunning=$true;source='SYNTHETIC_CI'} (Join-Path $public 'health.json')
  'Synthetic approved aggregate only. No identity or attendance rows.' | Set-Content -LiteralPath (Join-Path $public 'report.txt')
  $passwordBytes=[byte[]]::new(32);[Security.Cryptography.RandomNumberGenerator]::Fill($passwordBytes)
  $password=ConvertTo-SecureString ('Aa1!'+[Convert]::ToBase64String($passwordBytes)) -AsPlainText -Force
  [Security.Cryptography.CryptographicOperations]::ZeroMemory($passwordBytes)
  $account=New-LocalUser -Name $user -Password $password -Description 'Disposable biometric isolation CI only';$createdUser=$true;$userSid=$account.SID.Value
  Add-LocalGroupMember -SID 'S-1-5-32-545' -Member $account
  if($userSid -in @(Get-LocalGroupMember -SID 'S-1-5-32-544' | ForEach-Object {$_.SID.Value})){throw 'ISOLATION_TEST_USER_IS_ADMIN'}
  $replace=@(@{label='host';path=$hostPath},@{label='worker';path=$worker},@{label='native';path=$native},@{label='node';path=$node},@{label='serviceFixture';path=$agent})
  $configs=@(@{label='endpoint_interval_transport';path=$config},@{label='host_security';path=$hostConfig},@{label='ownership';path=(Join-Path $private 'companion-ownership.json')})
  $aclPaths=@(@{label='secret';path=$secret;directory=$false},@{label='queue';path=$queue;directory=$false},@{label='binary';path=$hostPath;directory=$false})
  $directories=@(@{label='package';path=$bin},@{label='private';path=$private},@{label='runtime';path=$runtime},@{label='binaryAncestor';path=$binParent},@{label='dataAncestor';path=$dataParent})
  foreach($d in $directories){$aclPaths+=@{label=$d.label;path=$d.path;directory=$true}}
  # An administrator confirms sources exist before the standard token's native
  # operations; missing sources, sharing errors and arbitrary failures never pass.
  foreach($item in ($replace+$configs+$aclPaths+$directories)){if(-not (Test-Path -LiteralPath $item.path)){throw 'ISOLATION_PROBE_SOURCE_MISSING'}}
  $startGate=Join-Path $public 'job-assigned'
  Json-File @{userSid=$userSid;startGate=$startGate;name=$name;sc=$sc;pwsh=$pwsh;binary=$binary;host=$hostPath;privateHostConfig=$hostConfig;publicHostConfig=(Join-Path $public 'host.json');management=(Join-Path $public 'companion.ps1');secret=$secret;queue=$queue;replaceFiles=$replace;configFiles=$configs;aclPaths=$aclPaths;renameDirectories=$directories;servicePid=(Get-CimInstance Win32_Service -Filter "Name='$name'").ProcessId;workerPid=(Owned-Children)[0].ProcessId;health=(Join-Path $public 'health.json');report=(Join-Path $public 'report.txt');dpapiControl=(Join-Path $public 'dpapi-control.bin')} (Join-Path $public 'cases.json')
  Fixture-Acl $public $userSid 'ReadAndExecute';Fixture-Acl $scratch $userSid 'Modify'
  $credential=[PSCredential]::new(($env:COMPUTERNAME+'\'+$user),$password)
  $probeJob=[BiometricProbeJob]::new()
  $probe=Start-Process -FilePath $pwsh -Credential $credential -LoadUserProfile -ArgumentList @('-NoProfile','-NonInteractive','-File',('"'+(Join-Path $public 'probe.ps1')+'"'),'-Cases',('"'+(Join-Path $public 'cases.json')+'"'),'-Output',('"'+(Join-Path $scratch 'result.json')+'"')) -PassThru -WindowStyle Hidden -WorkingDirectory $scratch -RedirectStandardOutput (Join-Path $scratch 'stdout.txt') -RedirectStandardError (Join-Path $scratch 'stderr.txt')
  $probeJob.Assign($probe.Handle)
  [IO.File]::WriteAllText($startGate,'assigned')
  if(-not $probe.WaitForExit(120000)){throw 'ISOLATION_STANDARD_PROBE_TIMEOUT'}
  if($probe.ExitCode -ne 0){
    # Only this authored probe emits safe labels. Never output arbitrary vendor/secret content.
    $probeError=Get-Content -LiteralPath (Join-Path $scratch 'stderr.txt') -Raw
    $safeMatches=[regex]::Matches($probeError,'ISOLATION_[A-Z_]+(?::[A-Za-z0-9_]+)*')
    $safe=if($safeMatches.Count){$safeMatches[$safeMatches.Count-1].Value}else{'NO_SAFE_CODE'}
    throw ('ISOLATION_STANDARD_PROBE_FAILED:'+$(if($safe){$safe}else{'NO_SAFE_CODE'}))
  }
  $standard=Get-Content -LiteralPath (Join-Path $scratch 'result.json') -Raw | ConvertFrom-Json
  if(@($standard.PSObject.Properties | Where-Object Value -ne $true).Count -ne 0){throw 'ISOLATION_STANDARD_RESULTS_FAILED'}
  Write-Output ('ISOLATION_STANDARD_DENIAL_AND_POSITIVE_CONTROLS_PASS:'+($standard | ConvertTo-Json -Compress))
  # Administrative maintenance and recovery use the unchanged management entry point.
  $since=(Get-Date).ToUniversalTime()
  & $pwsh -NoProfile -NonInteractive -File (Join-Path $public 'companion.ps1') -Action Restart -HostConfig $hostConfig -HostExe $hostPath -Apply -TargetComputer $env:COMPUTERNAME -ConfirmApply ("APPLY:"+$env:COMPUTERNAME) | Out-Null
  if($LASTEXITCODE -ne 0){throw 'ISOLATION_ADMIN_MAINTENANCE_FAILED'}
  Wait-Healthy $since
  $since=(Get-Date).ToUniversalTime();Stop-Process -Id (Owned-Children)[0].ProcessId -Force;Wait-Healthy $since
  Stop-Service $name;(Get-Service $name).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(20))
  if(@(Owned-Children).Count -ne 0){throw 'ISOLATION_STOP_ORPHAN'}
  # Hold an existing synthetic batch through the public queue API, then prove the
  # authorised recovery command preserves its body and releases that exact batch.
  $helper=Join-Path $bin 'held-control.mjs'
  @'
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { setRuntimeSecrets } from './dist/runtime-secrets.js';
import { EncryptedDurableQueue } from './dist/encrypted-queue.js';
const input=JSON.parse(readFileSync(0,'utf8'));setRuntimeSecrets(input.secrets);
const q=new EncryptedDurableQueue(input.queue);
if(input.action==='hold'){const b=q.prepareBatch();if(!b)throw Error('ISOLATION_HOLD_FAILED');q.batchFailed('BRIDGE_ACK_INVALID');writeFileSync(input.checkpoint,createHash('sha256').update(b.body).digest('hex'));}
else {const b=q.prepareBatch();if(!b || createHash('sha256').update(b.body).digest('hex')!==readFileSync(input.checkpoint,'utf8'))throw Error('ISOLATION_RESUME_BODY_FAILED');}
'@ | Set-Content -LiteralPath $helper
  $checkpoint=Join-Path $admin 'body.sha256'
  @{action='hold';secrets=($secrets | ConvertFrom-Json);queue=$queue;checkpoint=$checkpoint} | ConvertTo-Json -Compress | & $node $helper
  if($LASTEXITCODE -ne 0){throw 'ISOLATION_HELD_CONTROL_FAILED'}
  & $pwsh -NoProfile -NonInteractive -File (Join-Path $public 'companion.ps1') -Action Resume -HostConfig $hostConfig -HostExe $hostPath -Apply -TargetComputer $env:COMPUTERNAME -ConfirmApply ("APPLY:"+$env:COMPUTERNAME) | Out-Null
  if($LASTEXITCODE -ne 0){throw 'ISOLATION_ADMIN_RECOVERY_FAILED'}
  @{action='verify';secrets=($secrets | ConvertFrom-Json);queue=$queue;checkpoint=$checkpoint} | ConvertTo-Json -Compress | & $node $helper
  if($LASTEXITCODE -ne 0){throw 'ISOLATION_RESUME_VERIFICATION_FAILED'}
  $secrets=$null;$credential=$null;$password.Dispose()
  Write-Output 'ISOLATION_SERVICE_REQUIRED_READ_RUNTIME_WRITE_PRIVATE_WRITE_DENIAL_FRESH_POLL_ENCRYPTION_ADMIN_RESTART_CRASH_RECOVERY_HELD_BATCH_RESUME_PASS'
} catch {$failure=$_}
finally {
  $cleanupErrors=[Collections.Generic.List[string]]::new()
  try {
    if($probeJob){$probeJob.Terminate();$deadline=(Get-Date).AddSeconds(10);while($probeJob.ActiveProcesses -ne 0 -and (Get-Date) -lt $deadline){Start-Sleep -Milliseconds 100};if($probeJob.ActiveProcesses -ne 0){throw 'PROBE_DESCENDANTS_REMAIN'}}
  } catch {$cleanupErrors.Add('PROBE_DESCENDANTS')}
  finally {if($probeJob){$probeJob.Dispose()}}
  try {if($probe -and -not $probe.HasExited){Stop-Process -Id $probe.Id -Force;$probe.WaitForExit(10000) | Out-Null}} catch {$cleanupErrors.Add('PROBE_PROCESS')}
  if($probe){$probe.Dispose()};$credential=$null
  try {
    if($registered){$s=Get-Service $name;if($s.Status -ne 'Stopped'){Stop-Service $name;$s.WaitForStatus('Stopped',[TimeSpan]::FromSeconds(20))};Checked @('delete',$name)}
    if(Get-Service $name -ErrorAction SilentlyContinue){throw 'SERVICE_REMAINS'}
  } catch {$cleanupErrors.Add('SERVICE')}
  try {if($registered -and @(Owned-Children).Count -ne 0){throw 'WORKER_REMAINS'}} catch {$cleanupErrors.Add('WORKER')}
  try {
    if($createdUser){
      # Profile deletion is keyed to the created SID and its checked exact user path.
      $deadline=(Get-Date).AddSeconds(10)
      while(@(Get-CimInstance Win32_UserProfile -Filter "SID='$userSid'" | Where-Object Loaded).Count -and (Get-Date) -lt $deadline){Start-Sleep -Milliseconds 100}
      foreach($profile in @(Get-CimInstance Win32_UserProfile -Filter "SID='$userSid'")){
        $expected=Join-Path (Split-Path -Parent $env:USERPROFILE) $user
        if($profile.Loaded -or $profile.LocalPath -ne $expected){throw 'PROFILE_OWNERSHIP_GATE'}
        Remove-CimInstance -InputObject $profile
        if(Test-Path -LiteralPath $expected){throw 'PROFILE_DIRECTORY_REMAINS'}
      }
      Remove-LocalUser -SID $userSid
      if((Get-LocalUser $user -ErrorAction SilentlyContinue) -or (Get-CimInstance Win32_UserProfile -Filter "SID='$userSid'")){throw 'ACCOUNT_OR_PROFILE_REMAINS'}
    }
  } catch {$cleanupErrors.Add('ACCOUNT_PROFILE')}
  if(Get-Variable password -ErrorAction SilentlyContinue){$password.Dispose()}
  foreach($root in ($roots+$renameRoots)){
    try {
      $anchor=if($root -in @($binParent,$renameRoots[0])){$env:ProgramFiles}elseif($root -in @($dataParent,$renameRoots[1])){$env:ProgramData}else{$env:RUNNER_TEMP}
      $full=[IO.Path]::GetFullPath($root)
      if((Split-Path -Parent $full) -ne $anchor -or (Split-Path -Leaf $full) -notlike ($name+'*')){throw 'FIXTURE_OWNERSHIP_GATE'}
      if(Test-Path -LiteralPath $full){
        if((Get-Item -LiteralPath $full).Attributes -band [IO.FileAttributes]::ReparsePoint -or @(Get-ChildItem -LiteralPath $full -Recurse -Force | Where-Object {$_.Attributes -band [IO.FileAttributes]::ReparsePoint}).Count){throw 'FIXTURE_REPARSE_GATE'}
        Remove-Item -LiteralPath $full -Recurse -Force
      }
      if(Test-Path -LiteralPath $full){throw 'FIXTURE_REMAINS'}
    } catch {$cleanupErrors.Add('FIXTURE_'+(Split-Path -Leaf $root))}
  }
  if($cleanupErrors.Count){Write-Output ('ISOLATION_CLEANUP_INCOMPLETE:'+($cleanupErrors -join ','));if(-not $failure){$failure='ISOLATION_CLEANUP_FAILED'}}
  else {Write-Output 'ISOLATION_CLEANUP_ACCOUNT_PROFILE_SERVICE_PROCESSES_ALL_FIXTURES_VERIFIED'}
}
if($failure){throw $failure}
