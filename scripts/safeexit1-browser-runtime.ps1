param(
  [ValidateSet("start", "stop", "status")]
  [string]$Action = "status",
  [string]$Batch = "role-workflow",
  [ValidateSet("development", "production")]
  [string]$Mode = "development",
  [ValidateRange(1024, 65535)]
  [int]$Port = 3271
)
$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeRoot = (Resolve-Path (Join-Path $projectRoot "tmp\safeexit1browser-copied-qa")).Path
$operationalDatabase = (Resolve-Path (Join-Path $projectRoot "prisma\dev.db")).Path
$config = Get-Content -Raw -LiteralPath (Join-Path $runtimeRoot "runtime-env.json") | ConvertFrom-Json
$port = $Port
function Get-SafeExitListener { Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 }
if ($Action -eq "status") { $listener=Get-SafeExitListener;if($listener){Write-Output "LISTENING port=$port pid=$($listener.OwningProcess)"}else{Write-Output "STOPPED port=$port"};exit 0 }
if ($Action -eq "stop") { $listener=Get-SafeExitListener;if($listener){Stop-Process -Id $listener.OwningProcess;Write-Output "STOPPED pid=$($listener.OwningProcess)"}else{Write-Output "ALREADY_STOPPED"};exit 0 }
if(Get-SafeExitListener){throw "Port $port is already in use."}
$databasePath=[Uri]::UnescapeDataString(([string]$config.DATABASE_URL).Replace("file:","")).Replace("/","\")
if((Resolve-Path $databasePath).Path -eq $operationalDatabase){throw "SAFEEXIT1 Browser runtime refused the operational database."}
$env:DATABASE_URL=[string]$config.DATABASE_URL
$env:SESSION_SECRET=[string]$config.SESSION_SECRET
$env:AUTH_SECRET=[string]$config.AUTH_SECRET
$env:SAFE_EXIT_GATE_PASS_SECRET=[string]$config.SAFE_EXIT_GATE_PASS_SECRET
$env:WHATSAPP_PHONE_HASH_PEPPER=[string]$config.WHATSAPP_PHONE_HASH_PEPPER
$env:APP_ORIGIN="http://localhost:$port"
$env:PORT="$port"
$stdoutPath=Join-Path $runtimeRoot "$Batch.stdout.log";$stderrPath=Join-Path $runtimeRoot "$Batch.stderr.log"
$nextCommand=if($Mode -eq "production"){"start"}else{"dev"}
$process=Start-Process -FilePath "pnpm.cmd" -ArgumentList @("exec","next",$nextCommand,"--hostname","127.0.0.1","--port","$port") -WorkingDirectory $projectRoot -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -WindowStyle Hidden -PassThru
$deadline=(Get-Date).AddSeconds(45);do{Start-Sleep -Milliseconds 500;$listener=Get-SafeExitListener}while(-not $listener -and (Get-Date)-lt $deadline)
if(-not $listener){Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue;throw "SAFEEXIT1 runtime did not start. See $stderrPath."}
Write-Output "STARTED mode=$Mode port=$port pid=$($listener.OwningProcess) copiedDatabase=$databasePath"
