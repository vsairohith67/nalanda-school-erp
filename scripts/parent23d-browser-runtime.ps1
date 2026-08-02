param(
  [ValidateSet("start", "stop", "status")]
  [string]$Action = "status",
  [ValidateSet("batch1", "batch2", "batch3")]
  [string]$Batch = "batch1"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeRoot = (Resolve-Path (Join-Path $projectRoot "tmp\parent23d-browser")).Path
$operationalDatabase = (Resolve-Path (Join-Path $projectRoot "prisma\dev.db")).Path
$configPath = Join-Path $runtimeRoot "runtime-env.json"
$config = Get-Content -LiteralPath $configPath | ConvertFrom-Json
$port = 3218

function Get-Parent23dListener {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

if ($Action -eq "status") {
  $listener = Get-Parent23dListener
  if ($listener) { Write-Output "LISTENING port=$port pid=$($listener.OwningProcess)" }
  else { Write-Output "STOPPED port=$port" }
  exit 0
}

if ($Action -eq "stop") {
  $listener = Get-Parent23dListener
  if ($listener) { Stop-Process -Id $listener.OwningProcess; Write-Output "STOPPED pid=$($listener.OwningProcess)" }
  else { Write-Output "ALREADY_STOPPED" }
  exit 0
}

if (Get-Parent23dListener) { throw "Port $port is already in use." }
$databasePath = [Uri]::UnescapeDataString(([string]$config.DATABASE_URL).Replace("file:", "")).Replace("/", "\")
if ((Resolve-Path $databasePath).Path -eq $operationalDatabase) { throw "PARENT23D Browser runtime refused the operational database." }
$env:DATABASE_URL = [string]$config.DATABASE_URL
$env:SESSION_SECRET = [string]$config.SESSION_SECRET
$env:AUTH_SECRET = [string]$config.AUTH_SECRET
$env:APP_ORIGIN = [string]$config.APP_ORIGIN
$env:NODE_ENV = "production"
$env:PORT = "$port"
$stdoutPath = Join-Path $runtimeRoot "$Batch.stdout.log"
$stderrPath = Join-Path $runtimeRoot "$Batch.stderr.log"
$process = Start-Process -FilePath "pnpm.cmd" -ArgumentList @("exec", "next", "start", "-p", "$port") -WorkingDirectory $projectRoot -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -WindowStyle Hidden -PassThru
$deadline = (Get-Date).AddSeconds(45)
do { Start-Sleep -Milliseconds 500; $listener = Get-Parent23dListener } while (-not $listener -and (Get-Date) -lt $deadline)
if (-not $listener) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue; throw "PARENT23D production runtime did not start. See $stderrPath." }
$os = Get-CimInstance Win32_OperatingSystem
$used = 100 - (100 * $os.FreePhysicalMemory / $os.TotalVisibleMemorySize)
if ($used -ge 80) { Stop-Process -Id $listener.OwningProcess -Force; throw "PARENT23D memory use exceeded 80 percent." }
Write-Output "STARTED port=$port pid=$($listener.OwningProcess) memoryUsedPercent=$([math]::Round($used, 1))"
Write-Output "COPIED_DATABASE=$databasePath"
