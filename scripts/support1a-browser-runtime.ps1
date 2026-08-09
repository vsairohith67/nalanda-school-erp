param(
  [ValidateSet("start", "stop", "status")]
  [string]$Action = "status",
  [ValidateSet("public-parent", "staff-office", "director-mobile")]
  [string]$Batch = "public-parent"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeRoot = (Resolve-Path (Join-Path $projectRoot "tmp\support1abrowser-copied-qa")).Path
$operationalDatabase = (Resolve-Path (Join-Path $projectRoot "prisma\dev.db")).Path
$config = Get-Content -Raw -LiteralPath (Join-Path $runtimeRoot "runtime-env.json") | ConvertFrom-Json
$port = 3261

function Get-SupportListener {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

if ($Action -eq "status") {
  $listener = Get-SupportListener
  if ($listener) { Write-Output "LISTENING port=$port pid=$($listener.OwningProcess)" }
  else { Write-Output "STOPPED port=$port" }
  exit 0
}

if ($Action -eq "stop") {
  $listener = Get-SupportListener
  if ($listener) { Stop-Process -Id $listener.OwningProcess; Write-Output "STOPPED pid=$($listener.OwningProcess)" }
  else { Write-Output "ALREADY_STOPPED" }
  exit 0
}

if (Get-SupportListener) { throw "Port $port is already in use." }
$databasePath = [Uri]::UnescapeDataString(([string]$config.DATABASE_URL).Replace("file:", "")).Replace("/", "\")
if ((Resolve-Path $databasePath).Path -eq $operationalDatabase) { throw "SUPPORT1A Browser runtime refused the operational database." }
$env:DATABASE_URL = [string]$config.DATABASE_URL
$env:SESSION_SECRET = [string]$config.SESSION_SECRET
$env:AUTH_SECRET = [string]$config.AUTH_SECRET
$env:APP_ORIGIN = [string]$config.APP_ORIGIN
$env:NODE_ENV = "production"
$env:PORT = "$port"
$env:SUPPORT_PRIVATE_STORAGE_ROOT = [string]$config.SUPPORT_PRIVATE_STORAGE_ROOT
if ([string]$config.QPDF_EXECUTABLE_PATH) { $env:QPDF_EXECUTABLE_PATH = [string]$config.QPDF_EXECUTABLE_PATH }
$stdoutPath = Join-Path $runtimeRoot "$Batch.stdout.log"
$stderrPath = Join-Path $runtimeRoot "$Batch.stderr.log"
$process = Start-Process -FilePath "pnpm.cmd" -ArgumentList @("exec", "next", "start", "-p", "$port") -WorkingDirectory $projectRoot -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -WindowStyle Hidden -PassThru
$deadline = (Get-Date).AddSeconds(45)
do { Start-Sleep -Milliseconds 500; $listener = Get-SupportListener } while (-not $listener -and (Get-Date) -lt $deadline)
if (-not $listener) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue; throw "SUPPORT1A production runtime did not start. See $stderrPath." }
$os = Get-CimInstance Win32_OperatingSystem
$used = 100 - (100 * $os.FreePhysicalMemory / $os.TotalVisibleMemorySize)
if ($used -ge 90) { Stop-Process -Id $listener.OwningProcess -Force; throw "SUPPORT1A memory use reached the 90 percent ceiling." }
Write-Output "STARTED port=$port pid=$($listener.OwningProcess) memoryUsedPercent=$([math]::Round($used, 1))"
Write-Output "COPIED_DATABASE=$databasePath"
