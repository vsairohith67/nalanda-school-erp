param(
  [ValidateSet("start", "stop", "status")]
  [string]$Action = "status",
  [ValidatePattern("^sec1(?:qa)?-runtime$")]
  [string]$RuntimeName = "sec1-runtime",
  [ValidatePattern("^qasec1(?:qa)?-runtime\.db$")]
  [string]$DatabaseFile = "qasec1-runtime.db",
  [ValidateRange(1024, 65535)]
  [int]$Port = 3011,
  [ValidateSet("QASEC1", "QASEC1QA")]
  [string]$Marker = "QASEC1",
  [ValidateSet("single-process-rehearsal", "distributed")]
  [string]$RateLimitMode = "single-process-rehearsal"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeRoot = (Resolve-Path (Join-Path $projectRoot "tmp\$RuntimeName")).Path
$operationalDatabase = (Resolve-Path (Join-Path $projectRoot "prisma\dev.db")).Path
$qaDatabase = (Resolve-Path (Join-Path $runtimeRoot "database\$DatabaseFile")).Path
$stdoutPath = Join-Path $runtimeRoot "logs\production.stdout.log"
$stderrPath = Join-Path $runtimeRoot "logs\production.stderr.log"
$pidPath = Join-Path $runtimeRoot "temp\production-server.pid"

if ($qaDatabase -eq $operationalDatabase) {
  throw "SEC-1 runtime isolation failed: QA database resolves to the operational database."
}

function Get-Sec1Listener {
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

if ($Action -eq "status") {
  $listener = Get-Sec1Listener
  if ($listener) {
    Write-Output "LISTENING port=$Port pid=$($listener.OwningProcess)"
  } else {
    Write-Output "STOPPED port=$Port"
  }
  exit 0
}

if ($Action -eq "stop") {
  $listener = Get-Sec1Listener
  if ($listener) {
    Stop-Process -Id $listener.OwningProcess
    Write-Output "STOPPED pid=$($listener.OwningProcess)"
  } else {
    Write-Output "ALREADY_STOPPED"
  }
  exit 0
}

if (Get-Sec1Listener) {
  throw "Port $Port is already in use."
}

$env:QA20C_ISOLATED_DATABASE = "true"
$env:QA20C_OPERATIONAL_DATABASE_PATH = $operationalDatabase
$env:QA20C_ISOLATED_ROOT = $runtimeRoot
$env:DATABASE_URL = "file:$($qaDatabase.Replace('\', '/'))"
$env:SEC1_RUNTIME_ROOT = $runtimeRoot
$env:SEC1_BASE_URL = "http://127.0.0.1:$Port"
$env:SEC1_QA_MARKER = $Marker
$env:SEC1_QA_PASSWORD = "Qasec1qaRuntime@2026"
$env:CLOUD_BACKUP_LOCAL_FOLDER = Join-Path $runtimeRoot "provider"
$env:CLOUD_BACKUP_TEMP_DIR = Join-Path $runtimeRoot "temp"
$env:CLOUD_BACKUP_REHEARSAL_DIR = Join-Path $runtimeRoot "rehearsal"
$env:FEE_REGISTER_OCR_STORAGE_DIR = Join-Path $runtimeRoot "uploads"
$env:AUTH_SECRET = "$Marker-runtime-auth-secret-2026-at-least-32-characters"
$env:FIRST_RUN_BOOTSTRAP_TOKEN = "$Marker-runtime-bootstrap-token-2026-at-least-32-characters"
$env:BROWSER_RESTORE_COPIED_QA_ROOT = $runtimeRoot
$env:WHATSAPP_MOCK_WEBHOOK_SECRET = "$Marker-runtime-whatsapp-webhook-secret-2026"
$env:WHATSAPP_MOCK_VERIFY_TOKEN = "$Marker-runtime-whatsapp-verify-token-2026"
$env:WHATSAPP_PHONE_HASH_PEPPER = "$Marker-runtime-whatsapp-phone-hash-pepper-2026"
$env:SMS_EMAIL_MOCK_WEBHOOK_SECRET = "$Marker-runtime-sms-email-webhook-secret-2026"
$env:SMS_EMAIL_CONTACT_HASH_PEPPER = "$Marker-runtime-sms-email-contact-hash-pepper-2026"
$env:AI_ASSISTANT_AUDIT_HASH_PEPPER = "$Marker-runtime-ai-audit-hash-pepper-2026"
$env:SESSION_COOKIE_SECURE = "false"
$env:TRUST_PROXY_HEADERS = "true"
$env:APP_ORIGIN = "http://127.0.0.1:$Port"
$env:NALANDA_LOCAL_SECURITY_REHEARSAL = if ($RateLimitMode -eq "single-process-rehearsal") { "true" } else { "false" }
$env:SECURITY_RATE_LIMIT_MODE = $RateLimitMode
$env:RELEASE_FEATURE_FLAGS_QA_MODE = "SYNTHETIC_COPY_ONLY"
$env:RELEASE_FEATURE_FLAGS_QA_ENABLED = "public-admissions-form"
$env:QA20C_ISOLATED_DATABASE = "true"
$env:WHATSAPP_LIVE_ENABLED = "false"
$env:COMMUNICATION_LIVE_ENABLED = "false"
$env:CLOUD_BACKUP_LIVE_ENABLED = "false"
$env:NODE_ENV = "production"

$process = Start-Process `
  -FilePath "pnpm.cmd" `
  -ArgumentList @("exec", "next", "start", "-p", "$Port") `
  -WorkingDirectory $projectRoot `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -WindowStyle Hidden `
  -PassThru

$process.Id | Out-File -LiteralPath $pidPath -Encoding ascii
$deadline = (Get-Date).AddSeconds(45)
do {
  Start-Sleep -Milliseconds 500
  $listener = Get-Sec1Listener
} while (-not $listener -and (Get-Date) -lt $deadline)

if (-not $listener) {
  throw "Production server did not start within 45 seconds. See $stderrPath."
}

Write-Output "STARTED port=$Port pid=$($listener.OwningProcess)"
Write-Output "RATE_LIMIT_MODE=$RateLimitMode"
Write-Output "QA_DATABASE=$qaDatabase"
Write-Output "OPERATIONAL_DATABASE=$operationalDatabase"
