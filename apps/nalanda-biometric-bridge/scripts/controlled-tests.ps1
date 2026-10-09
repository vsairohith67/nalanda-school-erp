param(
  [Parameter(Mandatory=$true)][ValidateSet('focused','full','control-success','control-timeout')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ExpectedHead,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ExpectedTree
)
$ErrorActionPreference='Stop'
$taskRoot=(Get-Location).Path
$taskOutput=[IO.Path]::GetFullPath($OutputDirectory)
$taskAllowed=[IO.Path]::GetFullPath((Join-Path $taskRoot 'tmp\bridge-owned-test-controls'))+[IO.Path]::DirectorySeparatorChar
if (!$taskOutput.StartsWith($taskAllowed,[StringComparison]::OrdinalIgnoreCase) -or
    [IO.Path]::GetDirectoryName($taskOutput)+[IO.Path]::DirectorySeparatorChar -ne $taskAllowed -or
    [IO.Path]::GetFileName($taskOutput) -notmatch '^[a-f0-9-]{36}$' -or
    (Get-Item -LiteralPath $taskOutput).Attributes.HasFlag([IO.FileAttributes]::ReparsePoint)) { throw 'OWNED_CONTROL_OUTPUT_REQUIRED' }
if (![Environment]::Is64BitProcess -or $env:OS -ne 'Windows_NT' -or $ExecutionContext.SessionState.LanguageMode -ne 'FullLanguage') { throw 'WINDOWS_X64_CONTROL_CONTEXT_REQUIRED' }
if($env:GITHUB_ACTIONS -ne 'true') {
  if($PSVersionTable.PSEdition -ne 'Desktop' -or $PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or
     ([Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) -or
     (Get-ExecutionPolicy -Scope Process) -ne 'RemoteSigned' -or (Get-ExecutionPolicy) -ne 'RemoteSigned') {throw 'EXISTING_APPROVED_NON_ADMIN_5_1_DESCENDANT_REQUIRED'}
}
if ((& git rev-parse HEAD).Trim() -ne $ExpectedHead -or (& git show -s --format=%T HEAD).Trim() -ne $ExpectedTree -or (& git status --porcelain).Count -gt 0) { throw 'FROZEN_CLEAN_SOURCE_REQUIRED' }
# Inherit the already permitted context. A managed denial is not worked around:
# this helper never sets policy, invokes Bypass, unblocks a file or changes GPO.
Add-Type -Path (Join-Path $PSScriptRoot 'owned-test-job.cs') -ErrorAction Stop
[MasterWave2OwnedJob]::BindCurrentProcess()
[MasterWave2OwnedJob]::StartOwnedCapture((Join-Path $taskOutput 'owned-identities.tsv'))
$taskReceipt=@{head=$ExpectedHead;tree=$ExpectedTree;mode=$Mode;jobBound=$true;initialActive=[MasterWave2OwnedJob]::ActiveProcesses();startedUtc=[DateTime]::UtcNow.ToString('o');captureComplete=$false;activeBeforeExit=$null;commandExit=$null;failure=$null}
Write-Output (ConvertTo-Json -Compress -InputObject @{evidence='BRIDGE_TEST_COMMAND_OWNERSHIP_V1';stage='JOB_BOUND';head=$ExpectedHead;tree=$ExpectedTree;initialActive=$taskReceipt.initialActive})
try {
  if($Mode -eq 'control-success') {
    # A declared harmless child control, never a bridge/custody/device result.
    & node.exe -e 'setTimeout(()=>{},100)'
  } elseif($Mode -eq 'control-timeout') {
    # Fixed two-level descendants; the enclosing observer must end this job.
    & node.exe (Join-Path $PSScriptRoot 'harmless-timeout-child.mjs')
  } else {
    $taskArgs=@('--dir','apps/nalanda-biometric-bridge','test')
    if($Mode -eq 'focused') {$taskArgs+=@('src/export-integration.test.ts')}
    $taskArgs+=@('--reporter=default','--reporter=json',('--outputFile='+ (Join-Path $taskOutput 'vitest.json')))
    & pnpm.cmd @taskArgs
  }
  $taskReceipt.commandExit=$LASTEXITCODE
  if($LASTEXITCODE -ne 0) {throw 'ACTUAL_CONTROLLED_COMMAND_FAILED'}
  $taskReceipt.activeBeforeExit=[MasterWave2OwnedJob]::ActiveProcesses()
  if($taskReceipt.activeBeforeExit -ne 1) {throw 'OWNED_COMMAND_DESCENDANTS_REMAIN'}
} catch {$taskReceipt.failure='ACTUAL_COMMAND_OR_ACCOUNTING_FAILED'} finally {
  try {$taskReceipt.captureComplete=[MasterWave2OwnedJob]::StopOwnedCapture()} catch {$taskReceipt.captureComplete=$false}
  try {$taskReceipt.activeAtFinally=[MasterWave2OwnedJob]::ActiveProcesses()} catch {$taskReceipt.activeAtFinally=$null}
  $taskReceipt.endedUtc=[DateTime]::UtcNow.ToString('o')
  ConvertTo-Json -Depth 4 -InputObject $taskReceipt | Set-Content -LiteralPath (Join-Path $taskOutput 'job-receipt.json') -Encoding UTF8
}
if($taskReceipt.failure -or !$taskReceipt.captureComplete -or $taskReceipt.activeAtFinally -ne 1) {exit 1}
exit 0
