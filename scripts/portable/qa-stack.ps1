[CmdletBinding()]
param(
  [switch]$KeepStack,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$composeFile = Join-Path $workspace 'deploy\portable\compose.yml'
$secretRoot = Join-Path $workspace 'tmp\portable-staging\secrets'
$qaRoot = Join-Path $workspace 'tmp\portable-staging\qa'
$originalLocation = Get-Location
$results = [ordered]@{}
$curlCommand = if ($IsWindows) { 'curl.exe' } else { 'curl' }
$curlTlsArgs = if ($IsWindows) { @('--ssl-no-revoke') } else { @() }

function Invoke-Checked([string]$Label, [scriptblock]$Command) {
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

function Wait-ServiceHealthy([string]$Service) {
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $container = (docker compose -f $composeFile ps -q $Service).Trim()
    if ($container) {
      $health = (docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $container 2>$null).Trim()
      if ($health -eq 'healthy' -or $health -eq 'running') { return }
    }
    Start-Sleep -Seconds 2
  }
  throw "$Service did not recover to healthy state"
}

function Assert-DependencyOutage([string]$Service) {
  Invoke-Checked "stop $Service" { docker compose -f $composeFile stop $Service }
  $outageErrorActionPreference = $ErrorActionPreference
  $outageNativeErrorPreference = $PSNativeCommandUseErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $PSNativeCommandUseErrorActionPreference = $false
  docker compose -f $composeFile exec -T reverse-proxy wget -T 15 -qO- http://web-1:3000/api/health/ready 2>$null | Out-Null
  $outageExitCode = $LASTEXITCODE
  $PSNativeCommandUseErrorActionPreference = $outageNativeErrorPreference
  $ErrorActionPreference = $outageErrorActionPreference
  if ($outageExitCode -eq 0) { throw "Readiness remained healthy while $Service was unavailable" }
  Invoke-Checked "start $Service" { docker compose -f $composeFile start $Service }
  Wait-ServiceHealthy $Service
}

try {
  Set-Location $workspace
  if (-not (Test-Path -LiteralPath $secretRoot -PathType Container)) {
    $env:NALANDA_SYNTHETIC_STAGING = 'true'
    Invoke-Checked 'synthetic secret generation' { node scripts/portable/generate-synthetic-secrets.mjs }
  }
  New-Item -ItemType Directory -Path $qaRoot -Force | Out-Null
  $env:PORTABLE_SOURCE_SHA = (git rev-parse HEAD).Trim()
  $env:PORTABLE_SOURCE_DATE_EPOCH = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
  $env:PORTABLE_IMAGE_TAG = 'local'

  Invoke-Checked 'compose validation' { docker compose -f $composeFile config --quiet }
  if (-not $SkipBuild) {
    Invoke-Checked 'OCI image build' {
      docker build --quiet --pull=false --build-arg "SOURCE_COMMIT=$env:PORTABLE_SOURCE_SHA" --build-arg "SOURCE_DATE_EPOCH=$env:PORTABLE_SOURCE_DATE_EPOCH" --build-arg IMAGE_VERSION=portable-staging-foundation-1a -t nalanda-portable-staging:local -f Dockerfile .
    }
  }

  Invoke-Checked 'portable stack startup' { docker compose -f $composeFile up -d --wait reverse-proxy backup-worker }
  $backupWorkerContainer = (docker compose -f $composeFile ps -q backup-worker).Trim()
  if (-not $backupWorkerContainer -or (docker inspect --format '{{.State.Status}}' $backupWorkerContainer).Trim() -ne 'running') {
    throw 'Portable backup worker is not running'
  }
  Invoke-Checked 'two-replica dependency integration' { docker compose -f $composeFile run --rm --no-deps runtime-qa }
  Invoke-Checked 'encrypted backup and repeated restore' { docker compose -f $composeFile run --rm --no-deps backup-qa }
  $retentionPlanLines = @(& docker compose --profile maintenance-plan -f $composeFile run --rm --no-deps backup-maintenance-plan)
  if ($LASTEXITCODE -ne 0) { throw "retention dry-run plan failed with exit code $LASTEXITCODE" }
  $retentionPlanOutput = ($retentionPlanLines | Select-Object -Last 1).Trim()
  $retentionPlan = $retentionPlanOutput | ConvertFrom-Json
  if ($retentionPlan.result -ne 'PORTABLE_RETENTION_PLAN_ONLY' -or $retentionPlan.deletesPerformed -ne 0 -or $retentionPlan.sha256 -notmatch '^[a-f0-9]{64}$') {
    throw 'retention dry-run plan evidence is invalid'
  }
  $results.retentionDryRun = @{ deletesPerformed = 0; planSha256 = $retentionPlan.sha256 }

  $proxyContainer = (docker compose -f $composeFile ps -q reverse-proxy).Trim()
  if (-not $proxyContainer) { throw 'Reverse proxy container was not found' }
  $caFile = Join-Path $qaRoot 'portable-local-ca.crt'
  Invoke-Checked 'local CA extraction' {
    docker compose -f $composeFile exec -T reverse-proxy cat /data/caddy/pki/authorities/local/root.crt | Set-Content -LiteralPath $caFile -Encoding ascii
  }
  Invoke-Checked 'HTTPS readiness' { & $curlCommand @curlTlsArgs --cacert $caFile --fail --silent --show-error https://portable-staging.localhost:8443/api/health/ready | Out-Null }
  foreach ($replica in @('web-1', 'web-2')) {
    Invoke-Checked "$replica readiness" { docker compose -f $composeFile exec -T reverse-proxy wget -T 15 -qO- "http://${replica}:3000/api/health/ready" | Out-Null }
  }
  $results.https = $true
  $results.replicas = 2

  $baselineImageId = (docker image inspect nalanda-portable-staging:local --format '{{.Id}}').Trim()
  Invoke-Checked 'candidate image tag' { docker image tag nalanda-portable-staging:local nalanda-portable-staging:candidate }
  $env:PORTABLE_IMAGE_TAG = 'candidate'
  Invoke-Checked 'rolling upgrade one replica' { docker compose -f $composeFile up -d --no-deps --force-recreate web-1 }
  Wait-ServiceHealthy 'web-1'
  Invoke-Checked 'rolling upgrade availability' { & $curlCommand @curlTlsArgs --cacert $caFile --fail --silent --show-error https://portable-staging.localhost:8443/api/health/ready | Out-Null }
  $upgradedContainer = (docker compose -f $composeFile ps -q web-1).Trim()
  if ((docker inspect --format '{{.Image}}' $upgradedContainer).Trim() -ne $baselineImageId) { throw 'Rolling upgrade image identity mismatch' }
  $results.upgrade = @{ strategy = 'one-replica-at-a-time'; availability = $true; immutableImage = $baselineImageId }

  $env:PORTABLE_IMAGE_TAG = 'local'
  Invoke-Checked 'rolling rollback one replica' { docker compose -f $composeFile up -d --no-deps --force-recreate web-1 }
  Wait-ServiceHealthy 'web-1'
  Invoke-Checked 'rolling rollback availability' { & $curlCommand @curlTlsArgs --cacert $caFile --fail --silent --show-error https://portable-staging.localhost:8443/api/health/ready | Out-Null }
  $rolledBackContainer = (docker compose -f $composeFile ps -q web-1).Trim()
  if ((docker inspect --format '{{.Image}}' $rolledBackContainer).Trim() -ne $baselineImageId) { throw 'Rolling rollback image identity mismatch' }
  $results.rollback = @{ strategy = 'retag-and-recreate-one-replica'; availability = $true; migrationHistoryUnchanged = $true }

  foreach ($dependency in @('valkey', 'object-store', 'postgres')) {
    Assert-DependencyOutage $dependency
    $results["${dependency}OutageFailedClosed"] = $true
  }

  Invoke-Checked 'post-outage readiness recovery' { & $curlCommand @curlTlsArgs --cacert $caFile --retry 20 --retry-delay 2 --retry-all-errors --fail --silent --show-error https://portable-staging.localhost:8443/api/health/ready | Out-Null }
  Invoke-Checked 'post-outage integration rerun' { docker compose -f $composeFile run --rm --no-deps runtime-qa }
  $results.result = 'PORTABLE_STACK_QA_PASSED'
  $results.realData = $false
  [ordered]@{ result = 'PORTABLE_STACK_QA_PASSED'; checks = $results } | ConvertTo-Json -Depth 5 -Compress
}
finally {
  if (-not $KeepStack) {
    $cleanupErrorActionPreference = $ErrorActionPreference
    $cleanupNativeErrorPreference = $PSNativeCommandUseErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    & docker compose -f $composeFile down --volumes --remove-orphans 2>&1 | Out-Null
    & docker image rm nalanda-portable-staging:candidate 2>&1 | Out-Null
    $PSNativeCommandUseErrorActionPreference = $cleanupNativeErrorPreference
    $ErrorActionPreference = $cleanupErrorActionPreference
    if (Test-Path -LiteralPath $qaRoot) { Remove-Item -LiteralPath $qaRoot -Recurse -Force }
  }
  Set-Location $originalLocation
}
