param(
  [string]$RootRelative = "tmp/devops1c/rehearsal",
  [string]$PreviousReleaseRelative = "tmp/devops1c/rehearsal/releases/previous",
  [int]$BackendPort = 3101,
  [int]$ProxyPort = 3443
)

$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$approvedRoot = [IO.Path]::GetFullPath((Join-Path $workspace "tmp\devops1c"))
$root = [IO.Path]::GetFullPath((Join-Path $workspace $RootRelative))
$previousRelease = [IO.Path]::GetFullPath((Join-Path $workspace $PreviousReleaseRelative))

if ($root -ne $approvedRoot -and -not $root.StartsWith($approvedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw "LOCAL_REHEARSAL_ROOT_NOT_APPROVED"
}
if (-not (Test-Path -LiteralPath $root) -or -not (Test-Path -LiteralPath $previousRelease)) {
  throw "LOCAL_REHEARSAL_INPUT_MISSING"
}
& git -C $workspace check-ignore -q -- $root
if ($LASTEXITCODE -ne 0) { throw "LOCAL_REHEARSAL_ROOT_NOT_IGNORED" }

function New-RandomBytes([int]$count) {
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $buffer = New-Object byte[] $count
    $rng.GetBytes($buffer)
    return $buffer
  } finally {
    $rng.Dispose()
  }
}
function New-RandomHex([int]$count) {
  return ([BitConverter]::ToString((New-RandomBytes $count))).Replace("-", "")
}
function Assert-Exit([string]$label) {
  if ($LASTEXITCODE -ne 0) { throw "$label failed with exit code $LASTEXITCODE" }
}
function Stop-ExactProcess($process) {
  if ($null -ne $process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id
    [void]$process.WaitForExit(10000)
  }
}

$dataRoot = Join-Path $root "data"
$databasePath = Join-Path $dataRoot "database\staging.db"
if (-not (Test-Path -LiteralPath $databasePath)) { throw "LOCAL_REHEARSAL_DATABASE_MISSING" }

$env:NODE_ENV = "production"
$env:NALANDA_ENVIRONMENT = "staging"
$env:NALANDA_DEPLOYMENT_ID = "staging-devops1c-local"
$env:NALANDA_LOCAL_REHEARSAL = "true"
$env:QA20C_ISOLATED_DATABASE = "true"
$env:QA20C_ISOLATED_ROOT = $dataRoot
$env:QA20C_OPERATIONAL_DATABASE_PATH = (Resolve-Path -LiteralPath (Join-Path $workspace "prisma\dev.db")).Path
$env:STAGING_DATA_DIR = $dataRoot
$env:DATABASE_URL = "file:$($databasePath.Replace('\', '/'))"
$env:APP_ORIGIN = "https://staging.localhost"
$env:PUBLIC_WEBSITE_URL = $env:APP_ORIGIN
$env:PUBLIC_WEBSITE_INDEXING_ENABLED = "false"
$env:SESSION_COOKIE_SECURE = "true"
$env:ENABLE_HSTS = "true"
$env:ENABLE_HTTPS_UPGRADE = "true"
$env:TRUST_PROXY_HEADERS = "true"
$env:NALANDA_TRUSTED_PROXY_MODE = "single-hop-sanitized"
$env:FEE_REGISTER_OCR_STORAGE_DIR = Join-Path $dataRoot "private\ocr"
$env:BACKUP_DIRECTORY = Join-Path $dataRoot "backups\json"
$env:CLOUD_BACKUP_LOCAL_FOLDER = Join-Path $dataRoot "provider"
$env:CLOUD_BACKUP_TEMP_DIR = Join-Path $dataRoot "temp"
$env:CLOUD_BACKUP_REHEARSAL_DIR = Join-Path $dataRoot "rehearsal"
$env:NEXT_PUBLIC_PWA_BUILD_VERSION = "staging-devops1c-local"
$env:CLOUD_BACKUP_ENCRYPTION_KEY_V1 = [Convert]::ToBase64String((New-RandomBytes 32))
$env:WHATSAPP_LIVE_SENDING_ENABLED = "false"
$env:SMS_EMAIL_SMS_LIVE_ENABLED = "false"
$env:SMS_EMAIL_EMAIL_LIVE_ENABLED = "false"
$env:SMS_EMAIL_SUPERVISED_LIVE_ACTIVATION_ENABLED = "false"
$env:DEBUG = "false"
$env:NEXT_PUBLIC_DEBUG = "false"
$env:NALANDA_DEBUG = "false"
foreach ($name in @(
  "AUTH_SECRET", "FIRST_RUN_BOOTSTRAP_TOKEN", "WHATSAPP_MOCK_WEBHOOK_SECRET",
  "WHATSAPP_MOCK_VERIFY_TOKEN", "WHATSAPP_PHONE_HASH_PEPPER", "SMS_EMAIL_MOCK_WEBHOOK_SECRET",
  "SMS_EMAIL_CONTACT_HASH_PEPPER", "AI_ASSISTANT_AUDIT_HASH_PEPPER", "SEED_DIRECTOR_PASSWORD",
  "SEED_ADMIN_PASSWORD", "SEED_ACCOUNTANT_PASSWORD", "SEED_VIEWER_PASSWORD"
)) {
  Set-Item -Path "Env:$name" -Value (New-RandomHex 32)
}
$env:STAGING_SYNTHETIC_SEED_OPT_IN = "true"
$syntheticDirectorPassword = New-RandomHex 24
$env:STAGING_SYNTHETIC_DIRECTOR_PASSWORD = $syntheticDirectorPassword
$env:STAGING_SYNTHETIC_PRINCIPAL_PASSWORD = New-RandomHex 24
$env:STAGING_SYNTHETIC_TEACHER_PASSWORD = New-RandomHex 24
$env:STAGING_SYNTHETIC_PARENT_PASSWORD = New-RandomHex 24

$backend = $null
$proxy = $null
$rollback = $null
$logRoot = Join-Path $root "logs"
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$pfxPath = Join-Path $root "local-staging.pfx"
$pfxPassphrase = New-RandomHex 24

function Start-App([string]$workingDirectory, [string]$name) {
  $stdout = Join-Path $logRoot "$name.stdout.log"
  $stderr = Join-Path $logRoot "$name.stderr.log"
  $nextCli = Join-Path $workspace "node_modules\next\dist\bin\next"
  $arguments = "`"$nextCli`" start -H 127.0.0.1 -p $BackendPort"
  return Start-Process -FilePath (Get-Command node).Source -ArgumentList $arguments -WorkingDirectory $workingDirectory -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
}
function Invoke-Check([string]$name, [string]$path, [string]$method = "GET", [string]$body = "") {
  $headers = Join-Path $logRoot "$name.headers"
  $response = Join-Path $logRoot "$name.body"
  $arguments = @("-k", "-sS", "--connect-timeout", "2", "--max-time", "15", "-D", "-", "-o", $response, "-w", "`n__STATUS__:%{http_code}", "https://127.0.0.1:$ProxyPort$path")
  $requestFile = $null
  if ($method -eq "POST") {
    $requestFile = Join-Path $logRoot "$name.request.json"
    [IO.File]::WriteAllText($requestFile, $body, [Text.UTF8Encoding]::new($false))
    $arguments += @("-X", "POST", "-H", "content-type: application/json", "--data-binary", "@$requestFile")
  }
  try {
    $curlOutput = & curl.exe @arguments
    Assert-Exit "curl $name"
    $rawHeaders = $curlOutput -join "`n"
    if ($rawHeaders -notmatch "__STATUS__:(\d{3})") { throw "curl $name returned no status" }
    $status = [int]$Matches[1]
    $rawHeaders = $rawHeaders -replace "(?m)^__STATUS__:\d{3}\s*$", ""
    $safeHeaders = [Text.RegularExpressions.Regex]::Replace(
      $rawHeaders,
      "(?im)^(set-cookie:\s*[^=;\r\n]+)=[^;\r\n]*(.*)$",
      '$1=[REDACTED]$2'
    )
    [IO.File]::WriteAllText($headers, $safeHeaders, [Text.UTF8Encoding]::new($false))
    return [pscustomobject]@{
      Status = $status
      Headers = $safeHeaders.ToLowerInvariant()
      Body = (Get-Content -LiteralPath $response -Raw)
    }
  } finally {
    if ($requestFile -and (Test-Path -LiteralPath $requestFile)) {
      Remove-Item -LiteralPath $requestFile -Force
    }
  }
}
function Wait-ForHealth {
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      $result = Invoke-Check "health-wait" "/api/deployment-health"
      if ($result.Status -eq 200) { return $result }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  throw "LOCAL_REHEARSAL_HEALTH_TIMEOUT"
}

try {
  Push-Location $workspace
  try {
    & pnpm.cmd deployment:env-check
    Assert-Exit "deployment environment check"
    & pnpm.cmd staging:synthetic-seed
    Assert-Exit "synthetic seed"
    & pnpm.cmd staging:synthetic-check
    Assert-Exit "synthetic check"
    & pnpm.cmd backup
    Assert-Exit "synthetic backup"
    $latestBackup = Get-ChildItem -LiteralPath $env:BACKUP_DIRECTORY -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    $backupDocument = Get-Content -LiteralPath $latestBackup.FullName -Raw | ConvertFrom-Json
    if ($backupDocument.metadata.backupVersion -ne 37 -or @($backupDocument.students).Count -ne 1 -or @($backupDocument.payments).Count -ne 0) {
      throw "LOCAL_REHEARSAL_BACKUP_VALIDATION_FAILED"
    }
  } finally {
    Pop-Location
  }

  $rsa = [Security.Cryptography.RSA]::Create(2048)
  try {
    $request = [Security.Cryptography.X509Certificates.CertificateRequest]::new(
      "CN=staging.localhost", $rsa, [Security.Cryptography.HashAlgorithmName]::SHA256,
      [Security.Cryptography.RSASignaturePadding]::Pkcs1
    )
    $certificate = $request.CreateSelfSigned([DateTimeOffset]::Now.AddMinutes(-5), [DateTimeOffset]::Now.AddDays(2))
    try {
      [IO.File]::WriteAllBytes($pfxPath, $certificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $pfxPassphrase))
    } finally {
      $certificate.Dispose()
    }
  } finally {
    $rsa.Dispose()
  }

  $env:LOCAL_STAGING_BACKEND_PORT = "$BackendPort"
  $env:LOCAL_STAGING_HTTPS_PORT = "$ProxyPort"
  $env:LOCAL_STAGING_PFX_PATH = $pfxPath
  $env:LOCAL_STAGING_PFX_PASSPHRASE = $pfxPassphrase
  $backend = Start-App $workspace "current"
  $tsxCli = Join-Path $workspace "node_modules\tsx\dist\cli.mjs"
  $proxyScript = Join-Path $workspace "scripts\local-staging-https-proxy.ts"
  $proxyArguments = "`"$tsxCli`" `"$proxyScript`""
  $proxy = Start-Process -FilePath (Get-Command node).Source -ArgumentList $proxyArguments -WorkingDirectory $workspace -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot "proxy.stdout.log") -RedirectStandardError (Join-Path $logRoot "proxy.stderr.log") -PassThru

  $health = Wait-ForHealth
  $healthJson = $health.Body | ConvertFrom-Json
  if ($healthJson.status -ne "ok" -or $health.Headers -notmatch "cache-control:.*no-store" -or $health.Headers -notmatch "strict-transport-security:") {
    throw "LOCAL_REHEARSAL_HEALTH_OR_HEADERS_FAILED"
  }
  $protected = Invoke-Check "protected" "/settings"
  if ($protected.Status -notin @(302, 307, 308) -or $protected.Headers -notmatch "cache-control:.*no-store" -or $protected.Headers -notmatch "location:.*\/login") {
    throw "LOCAL_REHEARSAL_PROTECTED_PAGE_FAILED"
  }
  $privateApi = Invoke-Check "private-api" "/api/students"
  if ($privateApi.Status -ne 401 -or $privateApi.Headers -notmatch "cache-control:.*no-store") {
    throw "LOCAL_REHEARSAL_PRIVATE_API_FAILED"
  }
  $login = Invoke-Check "login" "/login"
  if ($login.Status -ne 200 -or $login.Headers -notmatch "cache-control:.*no-store") {
    throw "LOCAL_REHEARSAL_LOGIN_CACHE_FAILED"
  }
  $staticFile = Get-ChildItem -LiteralPath (Join-Path $workspace ".next\static") -Recurse -File | Select-Object -First 1
  $staticRelative = $staticFile.FullName.Substring((Join-Path $workspace ".next\static").Length).TrimStart("\").Replace("\", "/")
  $static = Invoke-Check "static" "/_next/static/$staticRelative"
  if ($static.Status -ne 200 -or $static.Headers -notmatch "cache-control:.*immutable") {
    throw "LOCAL_REHEARSAL_STATIC_CACHE_FAILED"
  }
  $loginBody = @{ identifier = "qa-director"; password = $syntheticDirectorPassword } | ConvertTo-Json -Compress
  $signedIn = Invoke-Check "signed-in" "/api/auth/login" "POST" $loginBody
  if (
    $signedIn.Status -ne 200 -or $signedIn.Headers -notmatch "set-cookie:.*secure" -or
    $signedIn.Headers -notmatch "set-cookie:.*httponly" -or $signedIn.Headers -notmatch "set-cookie:.*samesite=strict" -or
    $signedIn.Headers -notmatch "cache-control:.*no-store"
  ) {
    throw "LOCAL_REHEARSAL_SECURE_COOKIE_FAILED"
  }

  Stop-ExactProcess $backend
  $backend = $null
  $beforeRestartHash = (Get-FileHash -LiteralPath $databasePath -Algorithm SHA256).Hash
  $backend = Start-App $workspace "restart"
  $restartHealth = Wait-ForHealth
  $afterRestartHash = (Get-FileHash -LiteralPath $databasePath -Algorithm SHA256).Hash
  if ($restartHealth.Status -ne 200 -or $beforeRestartHash -ne $afterRestartHash) {
    throw "LOCAL_REHEARSAL_PERSISTENCE_RESTART_FAILED"
  }

  Stop-ExactProcess $backend
  $backend = $null
  $currentBuildId = (Get-Content -LiteralPath (Join-Path $workspace ".next\BUILD_ID") -Raw).Trim()
  $previousBuildId = (Get-Content -LiteralPath (Join-Path $previousRelease ".next\BUILD_ID") -Raw).Trim()
  if ($currentBuildId -eq $previousBuildId) { throw "LOCAL_REHEARSAL_RELEASES_NOT_DISTINCT" }
  $rollback = Start-App $previousRelease "rollback"
  $rollbackLogin = $null
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      $rollbackLogin = Invoke-Check "rollback-login" "/login"
      if ($rollbackLogin.Status -eq 200) { break }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  if ($null -eq $rollbackLogin -or $rollbackLogin.Status -ne 200) { throw "LOCAL_REHEARSAL_ROLLBACK_FAILED" }

  [pscustomobject]@{
    result = "LOCAL_STAGING_REHEARSAL_PASSED"
    health = $health.Status
    protectedRedirect = $protected.Status
    privateApi = $privateApi.Status
    secureCookie = $true
    hsts = $true
    privateNoStore = $true
    staticImmutable = $true
    backupVersion = 37
    restartDatabaseHashStable = $true
    rollbackLogin = $rollbackLogin.Status
    currentBuildId = $currentBuildId
    rollbackBuildId = $previousBuildId
    boundHost = "127.0.0.1"
    operationalDatabaseAccess = $false
  } | ConvertTo-Json -Compress
} finally {
  Stop-ExactProcess $rollback
  Stop-ExactProcess $backend
  Stop-ExactProcess $proxy
  if (Test-Path -LiteralPath $pfxPath) { Remove-Item -LiteralPath $pfxPath -Force }
  foreach ($name in @(
    "STAGING_SYNTHETIC_DIRECTOR_PASSWORD",
    "STAGING_SYNTHETIC_PRINCIPAL_PASSWORD",
    "STAGING_SYNTHETIC_TEACHER_PASSWORD",
    "STAGING_SYNTHETIC_PARENT_PASSWORD"
  )) {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
  }
  Remove-Item Env:LOCAL_STAGING_PFX_PASSPHRASE -ErrorAction SilentlyContinue
}
