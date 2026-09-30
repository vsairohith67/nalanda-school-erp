param([Parameter(Mandatory=$true)][string]$HostExe,[Parameter(Mandatory=$true)][string]$BridgeRoot)
$ErrorActionPreference='Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted') {throw 'SCM_TEST_REQUIRES_ADMITTED_DISPOSABLE_GITHUB_RUNNER'}
$name='NalandaBiometricQA'+$env:GITHUB_RUN_ID+'_'+$env:GITHUB_RUN_ATTEMPT
if (Get-Service -Name $name -ErrorAction SilentlyContinue) {throw 'SCM_TEST_NAME_ALREADY_EXISTS'}
$dir=Join-Path $env:RUNNER_TEMP $name
if (Test-Path -LiteralPath $dir) {throw 'SCM_TEST_DIRECTORY_ALREADY_EXISTS'}
New-Item -ItemType Directory -Path $dir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $dir 'data') | Out-Null
$node=(Get-Command node.exe).Source; $agent=Join-Path $BridgeRoot 'dist\agent.js';$config=Join-Path $dir 'bridge.json';$hostConfig=Join-Path $dir 'host.json';$secret=Join-Path $dir 'secret.dpapi'
@{bridgeId='00000000-0000-4000-8000-000000000001';erpUrl='https://erp.example.invalid';privateKeyPath='unused.jwk';queuePath='data/queue.enc';healthPath='data/health.json';pollIntervalMs=60000;transportEnabled=$false;syntheticOnly=$true;devices=@(@{deviceId='00000000-0000-4000-8000-000000000002';host='127.0.0.1';port=1;profile='SIMULATOR'})} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $config
@{serviceName=$name;nodeExe=$node;agentPath=$agent;bridgeConfig=$config;secretPath=$secret;workingDirectory=(Split-Path -Parent $agent);nodeSha256=(Get-FileHash -LiteralPath $node).Hash;agentSha256=(Get-FileHash -LiteralPath $agent).Hash;startupMs=10000;stopMs=3000;maxRestarts=2} | ConvertTo-Json | Set-Content -LiteralPath $hostConfig
$rng=New-Object byte[] 32;[Security.Cryptography.RandomNumberGenerator]::Fill($rng)
@{queueKey=([Convert]::ToBase64String($rng)).TrimEnd('=').Replace('+','-').Replace('/','_');keyVersion=1} | ConvertTo-Json -Compress | & $HostExe --provision $secret
if ($LASTEXITCODE -ne 0) {throw 'SCM_SECRET_PROVISION_FAILED'}
$sc="$env:SystemRoot\System32\sc.exe"; $registered=$false
function Checked([string[]]$Arguments){& $sc @Arguments | Out-Null;if($LASTEXITCODE -ne 0){throw "SCM_EXTERNAL_FAILED:$LASTEXITCODE"}}
function Owned-Children { @(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $node -and $_.CommandLine -like "*$config*"}) }
function Wait-Healthy([datetime]$Since) {
  $deadline=(Get-Date).AddSeconds(25);$health=Join-Path $dir 'data/health.json'
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $health) {
      try { $h=Get-Content -LiteralPath $health -Raw | ConvertFrom-Json
        if ($h.status -eq 'HEALTHY' -and $h.processRunning -and $h.lastPollAt -and ([datetime]$h.lastPollAt).ToUniversalTime() -ge $Since -and ([datetime]$h.updatedAt).ToUniversalTime() -ge $Since -and $h.queueDepth -gt 0 -and -not $h.adapterUnavailable -and (Test-Path -LiteralPath (Join-Path $dir 'data/queue.enc')) -and (Owned-Children).Count -eq 1) {return}
      } catch { }
    }
    Start-Sleep -Milliseconds 100
  }
  throw 'SCM_SUCCESSFUL_POLL_AND_QUEUE_REQUIRED'
}
try {
  Checked @('create',$name,'binPath=',('"'+$HostExe+'" --service "'+$hostConfig+'"'),'start=','demand','obj=',("NT SERVICE\"+$name))
  $registered=$true
  Checked @('sidtype',$name,'unrestricted')
  $sid=(New-Object Security.Principal.NTAccount("NT SERVICE\$name")).Translate([Security.Principal.SecurityIdentifier]).Value
  # Same machine DPAPI scope under a separate virtual service identity; configuration stays read-only.
  & "$env:SystemRoot\System32\icacls.exe" $dir /grant ("*"+$sid+':(OI)(CI)RX') /T | Out-Null
  if($LASTEXITCODE -ne 0){throw 'SCM_ACL_FAILED'}
  & "$env:SystemRoot\System32\icacls.exe" (Join-Path $dir 'data') /grant ("*"+$sid+':(OI)(CI)M') /T | Out-Null
  if($LASTEXITCODE -ne 0){throw 'SCM_RUNTIME_ACL_FAILED'}
  $since=(Get-Date).ToUniversalTime()
  Start-Service $name;(Get-Service $name).WaitForStatus('Running',[TimeSpan]::FromSeconds(20))
  Wait-Healthy $since
  Stop-Service $name;(Get-Service $name).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(20))
  if((Owned-Children).Count -ne 0){throw 'SCM_STOP_ORPHAN'}
  $since=(Get-Date).ToUniversalTime()
  Start-Service $name;(Get-Service $name).WaitForStatus('Running',[TimeSpan]::FromSeconds(20))
  Wait-Healthy $since
  $since=(Get-Date).ToUniversalTime()
  Stop-Process -Id (Owned-Children)[0].ProcessId -Force
  Wait-Healthy $since
  Stop-Service $name;(Get-Service $name).WaitForStatus('Stopped',[TimeSpan]::FromSeconds(20))
  Write-Output 'SCM_SYNTHETIC_VIRTUAL_IDENTITY_DPAPI_SUCCESSFUL_POLL_START_STOP_RESTART_PASS_NO_BOOT_OR_LOGOFF_PROOF'
} finally {
  if($registered){ if((Get-Service $name).Status -ne 'Stopped'){Stop-Service $name}; Checked @('delete',$name) }
  if((Owned-Children).Count -ne 0){throw 'SCM_CLEANUP_ORPHAN'}
  if(Get-Service $name -ErrorAction SilentlyContinue){throw 'SCM_CLEANUP_SERVICE_REMAINS'}
}
