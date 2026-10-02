param(
  [ValidateSet('Preflight','Plan','Install','Doctor','Validate','Restart','Resume','Upgrade','Rollback','Uninstall')][string]$Action='Preflight',
  [Parameter(Mandatory=$true)][string]$HostConfig,
  [string]$HostExe,
  [string]$TargetComputer,
  [string]$ConfirmApply,
  [switch]$Apply,
  [switch]$StartAfterInstall
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Invoke-Checked([string]$Exe,[string[]]$Arguments) {
  & $Exe @Arguments | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "COMPANION_EXTERNAL_FAILED:$LASTEXITCODE" }
}
function Absolute-File([string]$Value) {
  if (-not [IO.Path]::IsPathFullyQualified($Value) -or $Value -match '["\r\n]' -or $Value.StartsWith('\\')) {throw 'COMPANION_ABSOLUTE_LOCAL_PATH_REQUIRED'}
  $item=Get-Item -LiteralPath $Value
  $cursor=$item
  while ($cursor) {
    if ($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint) {throw 'COMPANION_REPARSE_POINT_FORBIDDEN'}
    $cursor=if ($cursor -is [IO.DirectoryInfo]) {$cursor.Parent} else {$cursor.Directory}
  }
  return $item.FullName
}
function Inside([string]$Child,[string]$Parent) {
  $c=[IO.Path]::GetFullPath($Child); $p=[IO.Path]::GetFullPath($Parent).TrimEnd('\')+'\'
  return $c.StartsWith($p,[StringComparison]::OrdinalIgnoreCase)
}
Import-Module (Join-Path $PSScriptRoot 'security.psm1') -Force
function Wait-State([string]$Name,[string]$State) {
  $service=Get-Service -Name $Name
  $service.WaitForStatus([ServiceProcess.ServiceControllerStatus]::$State,[TimeSpan]::FromSeconds(30))
}
function Assert-Owned($Service,$Owner,[string]$Name) {
  if (-not $Owner -or $Owner.task -ne 'BIOMETRIC-DESKTOP-COMPANION-1A' -or $Owner.serviceName -ne $Name -or $Owner.currentBinary -ne $Service.PathName -or $Service.StartName -ne "NT SERVICE\$Name") {throw 'COMPANION_EXISTING_SERVICE_NOT_OWNED'}
}
$configPath=Absolute-File $HostConfig
$cfg=Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$name=[string]$cfg.serviceName
if ($name -notmatch '^NalandaBiometric[A-Za-z0-9_-]{1,48}$') {throw 'COMPANION_SERVICE_NAME_INVALID'}
$hostPath=if ($HostExe) {Absolute-File $HostExe} else {Join-Path $PSScriptRoot 'host\publish\Nalanda.Biometric.Service.exe'}
$service=Get-CimInstance Win32_Service -Filter "Name='$name'"
$ownerFile=Join-Path (Split-Path -Parent $configPath) 'companion-ownership.json'
$owner=if (Test-Path -LiteralPath $ownerFile) {Get-Content -LiteralPath $ownerFile -Raw | ConvertFrom-Json} else {$null}
$changing=$Action -in @('Install','Restart','Resume','Upgrade','Rollback','Uninstall')
if ($changing -and -not $Apply) {
  [pscustomobject]@{action=$Action;result='DRY_RUN';service=$name;targetRequired=$true;identity="NT SERVICE\$name";delayedStart=$true;preservesQueueKeysConfiguration=$true} | ConvertTo-Json
  exit 0
}
if ($changing) {
  if ($TargetComputer -ne $env:COMPUTERNAME -or $ConfirmApply -ne "APPLY:$TargetComputer") {throw 'COMPANION_EXPLICIT_TARGET_AND_APPLY_REQUIRED'}
  $principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {throw 'COMPANION_ADMIN_REQUIRED'}
}
$sc="$env:SystemRoot\System32\sc.exe"
if ($Action -in @('Restart','Resume','Uninstall','Rollback','Upgrade')) {
  if (-not $service) {throw 'COMPANION_SERVICE_MISSING'}
  Assert-Owned $service $owner $name
}
if ($Action -in @('Preflight','Plan','Install','Upgrade','Validate','Doctor')) {
  if (-not [Environment]::Is64BitOperatingSystem) {throw 'COMPANION_WINDOWS_X64_REQUIRED'}
  $hostPath=Absolute-File $hostPath
  foreach ($p in @($cfg.nodeExe,$cfg.agentPath,$cfg.bridgeConfig,$cfg.secretPath)) { $null=Absolute-File $p }
  Invoke-Checked $hostPath @('--validate',$configPath)
  if ($Action -eq 'Install' -and ($service -or $owner)) {throw 'COMPANION_PREVIOUS_INSTALLATION_EXISTS'}
  # The signed host and owned package are deployment admission requirements.
  $signature=Get-AuthenticodeSignature -LiteralPath $hostPath
  $nodeSignature=Get-AuthenticodeSignature -LiteralPath $cfg.nodeExe
  $processes=@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $cfg.nodeExe -and $_.CommandLine -like "*$($cfg.agentPath)*" })
  $bridge=Get-Content -LiteralPath $cfg.bridgeConfig -Raw | ConvertFrom-Json
  $checks=[ordered]@{os='WINDOWS';architecture='X64';hostSignature=$signature.Status.ToString();nodeSignature=$nodeSignature.Status.ToString();runtime='SELF_CONTAINED_PACKAGE_REQUIRED';secretFileExists=$true;secretDecryptability='CHECK_UNDER_SERVICE_IDENTITY';duplicateWorkerCount=$processes.Count;endpointConfigured=([uri]$bridge.erpUrl).Scheme -eq 'https';transportEnabled=$bridge.transportEnabled;ipc='INHERITED_ANONYMOUS_PIPE_NO_LISTENER';existingService=([bool]$service);fileAcl='REQUIRES_SERVICE_AND_STANDARD_USER_PROBE';accountantAdminMembership='DEPLOYMENT_GATE'}
  if ($Action -in @('Preflight','Plan','Validate','Doctor')) { $checks | ConvertTo-Json; if ($Action -eq 'Doctor' -and $service) { [pscustomobject]@{state=$service.State;processId=$service.ProcessId;identity=$service.StartName} | ConvertTo-Json }; exit 0 }
  $ownedProcesses=@()
  if ($Action -eq 'Upgrade' -and $service) { Assert-Owned $service $owner $name; $ownedProcesses=@($processes | Where-Object { $_.ParentProcessId -eq $service.ProcessId }) }
  if ($signature.Status -ne 'Valid' -or $nodeSignature.Status -ne 'Valid' -or $processes.Count -ne $ownedProcesses.Count) {throw 'COMPANION_PACKAGE_OR_DUPLICATE_GATE'}
}
$binary='"'+$hostPath+'" --service "'+$configPath+'"'
if ($Action -eq 'Install' -or $Action -eq 'Upgrade') {
  $binRoot=Split-Path -Parent $hostPath; $dataRoot=Split-Path -Parent $configPath
  if (-not (Inside $binRoot $env:ProgramFiles) -or -not (Inside $dataRoot $env:ProgramData) -or -not (Inside $cfg.nodeExe $binRoot) -or -not (Inside $cfg.agentPath $binRoot) -or -not (Inside $cfg.secretPath $dataRoot) -or -not (Inside $cfg.bridgeConfig $dataRoot)) {throw 'COMPANION_PROTECTED_LOCATIONS_REQUIRED'}
  foreach ($root in @($binRoot,$dataRoot)) { $null=Absolute-File $root }
  $bridgeRoot=Split-Path -Parent $cfg.bridgeConfig
  $runtimeDirectories=@()
  foreach ($relative in @($bridge.queuePath,$bridge.healthPath)) {
    $runtimePath=[IO.Path]::GetFullPath((Join-Path $bridgeRoot $relative)); $runtimeDir=Split-Path -Parent $runtimePath
    if (-not (Inside $runtimeDir $dataRoot) -or $runtimeDir -eq $dataRoot -or (Inside $cfg.secretPath $runtimeDir) -or (Inside $configPath $runtimeDir) -or (Inside $cfg.bridgeConfig $runtimeDir) -or (Inside $ownerFile $runtimeDir)) {throw 'COMPANION_MUTABLE_PATH_SEPARATION_REQUIRED'}
    $runtimeDirectories+=$runtimeDir
  }
  # Validate every intermediate parent below the protected OS anchor. An untrusted
  # owner/custom-group writer can regrant delete-child and replace even a protected root.
  $trustedInstaller=(New-Object Security.Principal.NTAccount('NT SERVICE\TrustedInstaller')).Translate([Security.Principal.SecurityIdentifier]).Value
  $trustedOwners=@('S-1-5-18','S-1-5-32-544',$trustedInstaller)
  $dangerous=[Security.AccessControl.FileSystemRights]::WriteData -bor [Security.AccessControl.FileSystemRights]::AppendData -bor [Security.AccessControl.FileSystemRights]::Delete -bor [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor [Security.AccessControl.FileSystemRights]::ChangePermissions -bor [Security.AccessControl.FileSystemRights]::TakeOwnership
  foreach ($root in @($binRoot,$dataRoot)) {
    $anchor=if ($root -eq $binRoot) {$env:ProgramFiles} else {$env:ProgramData}
    $parent=Split-Path -Parent $root
    while ($parent -and $parent -ne $anchor) {
      $parentAcl=Get-Acl -LiteralPath $parent
      if ($parentAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin $trustedOwners) {throw 'COMPANION_PARENT_OWNER_GATE'}
      foreach ($rule in $parentAcl.Access) {
        $ruleSid=$rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
        if ($ruleSid -notin $trustedOwners -and $rule.AccessControlType -eq 'Allow' -and ($rule.FileSystemRights -band $dangerous)) {throw 'COMPANION_PARENT_RENAME_PERMISSION_GATE'}
      }
      $parent=Split-Path -Parent $parent
    }
  }
  # Refuse junctions/symlinks throughout each task-owned subtree before applying ACLs.
  foreach ($root in @($binRoot,$dataRoot)) { if (@(Get-ChildItem -LiteralPath $root -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) {throw 'COMPANION_REPARSE_POINT_FORBIDDEN'} }
  if ($Action -eq 'Install') {
    Invoke-Checked $sc @('create',$name,'binPath=',$binary,'start=','delayed-auto','obj=',"NT SERVICE\$name",'DisplayName=','Nalanda Biometric Companion')
  } else {
    Stop-Service -Name $name; Wait-State $name 'Stopped'
    if (@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $cfg.nodeExe -and $_.CommandLine -like "*$($cfg.agentPath)*" }).Count) {throw 'COMPANION_UPGRADE_CHILD_CLEANUP_FAILED'}
    Invoke-Checked $sc @('config',$name,'binPath=',$binary)
  }
  Invoke-Checked $sc @('sidtype',$name,'unrestricted')
  Invoke-Checked $sc @('failure',$name,'reset=','86400','actions=','restart/5000/restart/15000/restart/60000')
  Invoke-Checked $sc @('failureflag',$name,'1')
  Protect-CompanionService $name
  $sid=(New-Object Security.Principal.NTAccount("NT SERVICE\$name")).Translate([Security.Principal.SecurityIdentifier]).Value
  Private-Acl $binRoot $sid 'ReadAndExecute'
  Private-Acl $dataRoot $sid 'ReadAndExecute'
  foreach ($runtimeDir in ($runtimeDirectories | Select-Object -Unique)) {
    New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
    Private-Acl $runtimeDir $sid 'Modify'
  }
  $record=@{task='BIOMETRIC-DESKTOP-COMPANION-1A';serviceName=$name;currentBinary=$binary;previousBinary=$(if ($service) {$service.PathName} else {$null});hostConfig=$configPath}
  $record | ConvertTo-Json | Set-Content -LiteralPath $ownerFile -Encoding utf8
  if ($StartAfterInstall) {Start-Service -Name $name; Wait-State $name 'Running'}
  Write-Output 'COMPANION_REGISTERED_NOT_HARDWARE_ACCEPTED'
} elseif ($Action -eq 'Restart') {
  Stop-Service -Name $name; Wait-State $name 'Stopped'; Start-Service -Name $name; Wait-State $name 'Running'; Write-Output 'COMPANION_RESTARTED'
} elseif ($Action -eq 'Resume') {
  if ($service.State -ne 'Stopped' -or $service.PathName -ne $binary) {throw 'COMPANION_RESUME_REQUIRES_STOPPED_OWNED_PACKAGE'}
  Invoke-Checked (Absolute-File $hostPath) @('--resume',$configPath)
  Write-Output 'COMPANION_HELD_BATCH_RESUMED_RESTART_REQUIRES_REVALIDATED_TRANSPORT'
} elseif ($Action -eq 'Rollback') {
  if (-not $owner.previousBinary) {throw 'COMPANION_ROLLBACK_CHECKPOINT_MISSING'}
  if ($owner.previousBinary -notmatch '^"([^"]+)" --service "([^"]+)"$') {throw 'COMPANION_ROLLBACK_COMMAND_INVALID'}
  $previousHost=Absolute-File $Matches[1]; $previousConfig=Absolute-File $Matches[2]
  if ((Get-AuthenticodeSignature -LiteralPath $previousHost).Status -ne 'Valid') {throw 'COMPANION_ROLLBACK_PROVENANCE_GATE'}
  Invoke-Checked $previousHost @('--validate',$previousConfig)
  Stop-Service -Name $name; Wait-State $name 'Stopped'
  Invoke-Checked $sc @('config',$name,'binPath=',$owner.previousBinary)
  $old=$owner.currentBinary; $owner.currentBinary=$owner.previousBinary; $owner.previousBinary=$old
  $owner | ConvertTo-Json | Set-Content -LiteralPath $ownerFile -Encoding utf8
  if ($StartAfterInstall) {Start-Service -Name $name; Wait-State $name 'Running'}
  Write-Output 'COMPANION_ROLLED_BACK_DATA_PRESERVED'
} elseif ($Action -eq 'Uninstall') {
  if ($service.State -ne 'Stopped') {Stop-Service -Name $name; Wait-State $name 'Stopped'}
  Invoke-Checked $sc @('delete',$name)
  Write-Output 'COMPANION_UNREGISTERED_DATA_KEYS_QUEUE_AND_OWNERSHIP_PRESERVED'
}
