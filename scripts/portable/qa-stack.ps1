[CmdletBinding()]
param(
  [switch]$KeepStack,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
if ($KeepStack -or $SkipBuild) { throw 'Ephemeral CI requires immutable admission and full cleanup; legacy build switches are forbidden' }
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$composeFile = Join-Path $workspace 'deploy\portable\compose.yml'
$env:COMPOSE_PROJECT_NAME = "nalanda-ci-$env:GITHUB_RUN_ID-$env:GITHUB_RUN_ATTEMPT-stack"
$env:PORTABLE_CI_ROOT = Join-Path $workspace "tmp/portable-staging/$env:COMPOSE_PROJECT_NAME"
$env:PORTABLE_SYNTHETIC_SECRET_ROOT = Join-Path $env:PORTABLE_CI_ROOT 'secrets'
$secretRoot = $env:PORTABLE_SYNTHETIC_SECRET_ROOT
$qaRoot = Join-Path $env:PORTABLE_CI_ROOT 'qa'
$originalLocation = Get-Location
$results = [ordered]@{}
$admitted = $false
$isWindowsHost = $env:OS -eq 'Windows_NT'
$curlCommand = if ($isWindowsHost) { (Get-Command curl.exe -ErrorAction Stop).Source } else { 'curl' }

function Invoke-Checked([string]$Label, [scriptblock]$Command) {
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

function Wait-ServiceHealthy([string]$Service) {
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $container = (docker --context default compose -f $composeFile ps -q $Service).Trim()
    if ($container) {
      $health = (docker --context default inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $container 2>$null).Trim()
      if ($health -eq 'healthy' -or $health -eq 'running') { return }
    }
    Start-Sleep -Seconds 2
  }
  throw "$Service did not recover to healthy state"
}

function Invoke-HttpsReadiness([string]$CaFile, [switch]$Retry) {
  [string[]]$curlArguments = @()
  if ($isWindowsHost) { $curlArguments += '--ssl-no-revoke' }
  $curlArguments += @('--cacert', $CaFile)
  if ($Retry) { $curlArguments += @('--retry', '20', '--retry-delay', '2', '--retry-all-errors') }
  $curlArguments += @('--fail', '--silent', '--show-error', 'https://portable-staging.localhost:8443/api/health/ready')
  & $curlCommand $curlArguments | Out-Null
}

function Assert-DependencyOutage([string]$Service) {
  Invoke-Checked "stop $Service" { docker --context default compose -f $composeFile stop $Service }
  $outageErrorActionPreference = $ErrorActionPreference
  $outageNativeErrorPreference = $PSNativeCommandUseErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $PSNativeCommandUseErrorActionPreference = $false
  docker --context default compose -f $composeFile exec -T reverse-proxy wget -T 15 -qO- http://web-1:3000/api/health/ready 2>$null | Out-Null
  $outageExitCode = $LASTEXITCODE
  $PSNativeCommandUseErrorActionPreference = $outageNativeErrorPreference
  $ErrorActionPreference = $outageErrorActionPreference
  if ($outageExitCode -eq 0) { throw "Readiness remained healthy while $Service was unavailable" }
  Invoke-Checked "start $Service" { docker --context default compose -f $composeFile start $Service }
  Wait-ServiceHealthy $Service
}

try {
  Set-Location $workspace
  $admittedImage = (& pnpm exec tsx scripts/portable/admit-artifact.ts | Select-Object -Last 1).Trim()
  if ($LASTEXITCODE -ne 0 -or $admittedImage -notmatch '^sha256:[a-f0-9]{64}$') { throw 'IMMUTABLE_ARTIFACT_ADMISSION_REQUIRED' }
  $env:PORTABLE_IMAGE_ID = $admittedImage
  Invoke-Checked 'ephemeral exact-head CI admission' { pnpm exec tsx scripts/portable/ci-safety.ts prepare }
  $admitted = $true
  if (-not (Test-Path -LiteralPath $secretRoot -PathType Container)) {
    $env:NALANDA_SYNTHETIC_STAGING = 'true'
    Invoke-Checked 'synthetic secret generation' { node scripts/portable/generate-synthetic-secrets.mjs }
  }
  New-Item -ItemType Directory -Path $qaRoot -Force | Out-Null
  $env:PORTABLE_SOURCE_SHA = (git rev-parse HEAD).Trim()
  $env:PORTABLE_SOURCE_DATE_EPOCH = (git show -s --format=%ct HEAD).Trim()
  $env:PORTABLE_IMAGE_TAG = $env:COMPOSE_PROJECT_NAME

  Invoke-Checked 'compose validation' { docker --context default compose -f $composeFile config --quiet }
  Invoke-Checked 'resolved service boundary validation' { pnpm exec tsx scripts/portable/ci-safety.ts validate }
  Invoke-Checked 'pinned infrastructure preload and security gates' { pnpm exec tsx scripts/portable/prepare-infrastructure.ts }
  Invoke-Checked 'portable stack startup' { docker --context default compose -f $composeFile up --no-build --pull never -d --wait reverse-proxy backup-worker }
  foreach ($service in @('web-1','web-2','backup-worker')) {
    $container = (docker --context default compose -f $composeFile ps -q $service).Trim()
    if (-not $container) { throw 'RUNNING_CONTAINER_MISSING' }
    Invoke-Checked 'full running image boundary' { pnpm exec tsx scripts/portable/verify-running-artifact.ts $container }
  }
  $backupWorkerContainer = (docker --context default compose -f $composeFile ps -q backup-worker).Trim()
  if (-not $backupWorkerContainer -or (docker --context default inspect --format '{{.State.Status}}' $backupWorkerContainer).Trim() -ne 'running') {
    throw 'Portable backup worker is not running'
  }
  Invoke-Checked 'two-replica dependency integration' { docker --context default compose -f $composeFile run --pull never --rm --no-deps runtime-qa }
  Invoke-Checked 'encrypted backup and repeated restore' { docker --context default compose -f $composeFile run --pull never --rm --no-deps backup-qa }
  $operatorBackupLines = @(& docker --context default compose -f $composeFile run --pull never --rm --no-deps -e PORTABLE_OPERATOR_CI=true backup-qa dist/portable/operator-recovery.mjs backup aaaaaaaaaaaaaaaa)
  if ($LASTEXITCODE -ne 0) { throw 'Operator backup process failed' }
  $operatorBackup = ($operatorBackupLines | Select-Object -Last 1) | ConvertFrom-Json
  if ($operatorBackup.state -ne 'VERIFIED' -or $operatorBackup.backupVersion -ne 48 -or $operatorBackup.ciphertextSha256 -notmatch '^[a-f0-9]{64}$') { throw 'Operator backup verification failed' }
  foreach ($operationId in @('bbbbbbbbbbbbbbbb', 'cccccccccccccccc')) {
    $restoreLines = @(& docker --context default compose -f $composeFile run --pull never --rm --no-deps -e PORTABLE_OPERATOR_CI=true backup-qa dist/portable/operator-recovery.mjs restore $operatorBackup.id $operatorBackup.ciphertextSha256 $operationId)
    if ($LASTEXITCODE -ne 0) { throw 'Operator restore process failed' }
    $restored = ($restoreLines | Select-Object -Last 1) | ConvertFrom-Json
    if ($restored.state -ne 'RESTORED' -or -not $restored.emptyTargetReserved -or $restored.existingDataOverwritten) { throw 'Operator restore terminal evidence failed' }
  }
  $results.operatorRecovery = @{ backup = 'VERIFIED'; emptySchemaRestores = 2; existingDataOverwritten = $false; backupVersion = 48 }
  $retentionPlanLines = @(& docker --context default compose --profile maintenance-plan -f $composeFile run --pull never --rm --no-deps backup-maintenance-plan)
  if ($LASTEXITCODE -ne 0) { throw "retention dry-run plan failed with exit code $LASTEXITCODE" }
  $retentionPlanOutput = ($retentionPlanLines | Select-Object -Last 1).Trim()
  $retentionPlan = $retentionPlanOutput | ConvertFrom-Json
  if ($retentionPlan.result -ne 'PORTABLE_RETENTION_PLAN_ONLY' -or $retentionPlan.deletesPerformed -ne 0 -or $retentionPlan.sha256 -notmatch '^[a-f0-9]{64}$') {
    throw 'retention dry-run plan evidence is invalid'
  }
  $results.retentionDryRun = @{ deletesPerformed = 0; planSha256 = $retentionPlan.sha256 }

  $proxyContainer = (docker --context default compose -f $composeFile ps -q reverse-proxy).Trim()
  if (-not $proxyContainer) { throw 'Reverse proxy container was not found' }
  $caFile = Join-Path $qaRoot 'portable-local-ca.crt'
  Invoke-Checked 'local CA extraction' {
    docker --context default compose -f $composeFile exec -T reverse-proxy cat /data/caddy/pki/authorities/local/root.crt | Set-Content -LiteralPath $caFile -Encoding ascii
  }
  Invoke-Checked 'HTTPS readiness' { Invoke-HttpsReadiness $caFile }
  foreach ($replica in @('web-1', 'web-2')) {
    Invoke-Checked "$replica readiness" { docker --context default compose -f $composeFile exec -T reverse-proxy wget -T 15 -qO- "http://${replica}:3000/api/health/ready" | Out-Null }
  }
  $results.https = $true
  $results.replicas = 2

  $baselineImageId = $admittedImage
  Invoke-Checked 'same-image replica restart' { docker --context default compose -f $composeFile up --no-build --pull never -d --no-deps --force-recreate web-1 }
  Wait-ServiceHealthy 'web-1'
  Invoke-Checked 'rolling upgrade availability' { Invoke-HttpsReadiness $caFile }
  $upgradedContainer = (docker --context default compose -f $composeFile ps -q web-1).Trim()
  if ((docker --context default inspect --format '{{.Image}}' $upgradedContainer).Trim() -ne $baselineImageId) { throw 'Rolling upgrade image identity mismatch' }
  $results.replicaRestart = @{ strategy = 'same-image-recreate'; availability = $true; immutableImage = $baselineImageId }

  $env:PORTABLE_IMAGE_TAG = $env:COMPOSE_PROJECT_NAME
  Invoke-Checked 'repeat same-image replica restart' { docker --context default compose -f $composeFile up --no-build --pull never -d --no-deps --force-recreate web-1 }
  Wait-ServiceHealthy 'web-1'
  Invoke-Checked 'rolling rollback availability' { Invoke-HttpsReadiness $caFile }
  $rolledBackContainer = (docker --context default compose -f $composeFile ps -q web-1).Trim()
  if ((docker --context default inspect --format '{{.Image}}' $rolledBackContainer).Trim() -ne $baselineImageId) { throw 'Rolling rollback image identity mismatch' }
  $results.historicalUpgradeRollback = @{ state = 'NOT_EXECUTED'; prerequisite = 'Distinct qualified historical images and compatible schema contracts' }

  foreach ($dependency in @('valkey', 'object-store', 'postgres')) {
    Assert-DependencyOutage $dependency
    $results["${dependency}OutageFailedClosed"] = $true
  }

  Invoke-Checked 'post-outage readiness recovery' { Invoke-HttpsReadiness $caFile -Retry }
  Invoke-Checked 'post-outage integration rerun' { docker --context default compose -f $composeFile run --pull never --rm --no-deps runtime-qa }
  $env:NODE_EXTRA_CA_CERTS = $caFile
  $httpContainer = (docker --context default compose -f $composeFile ps -q web-1).Trim()
  Invoke-Checked 'authenticated production OFF mutations and authoritative readback' { pnpm exec tsx scripts/portable/integrated-acceptance.ts --run-off (Join-Path $qaRoot 'integrated-off-fixture.json') $httpContainer }
  $results.productionOffHttp = 'PASSED_WITH_SAME_CONTAINER_READBACK'
  $results.result = 'PORTABLE_STACK_QA_PASSED'
  $results.realData = $false
}
finally {
  if ($admitted) { Invoke-Checked 'complete ephemeral cleanup and readback' { pnpm exec tsx scripts/portable/ci-safety.ts cleanup } }
  Set-Location $originalLocation
}
$publicReceipt = [ordered]@{ contract = 'NALANDA_SAME_RUNNER_STACK_V1'; source = $env:EXPECTED_SHA; architecture = $env:TARGET_ARCHITECTURE; imageConfigDigest = $admittedImage; state = 'PASSED'; cleanup = 'VERIFIED'; historicalUpgradeRollback = 'NOT_EXECUTED' }
$publicReceipt | ConvertTo-Json -Compress | Set-Content -LiteralPath (Join-Path $workspace 'stack-result.json') -Encoding utf8
[ordered]@{ result = 'PORTABLE_STACK_QA_PASSED'; classification = 'INTEGRATION_TEST_ENVIRONMENT'; cleanup = 'VERIFIED'; checks = $results } | ConvertTo-Json -Depth 5 -Compress
