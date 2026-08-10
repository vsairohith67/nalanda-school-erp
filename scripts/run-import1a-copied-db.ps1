$ErrorActionPreference = "Stop"

$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$qaRoot = [System.IO.Path]::GetFullPath((Join-Path $workspace "tmp\devops1b"))
$sourceDb = (Resolve-Path (Join-Path $workspace "prisma\dev.db")).Path
if (-not $sourceDb.StartsWith($workspace, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "SOURCE_DATABASE_OUTSIDE_WORKSPACE"
}

$copyFolder = Join-Path $qaRoot "operational-copy"
$restoreFolder = Join-Path $qaRoot "restore"
$privateFolder = Join-Path $qaRoot "private-import1a"
New-Item -ItemType Directory -Force -Path $copyFolder, $restoreFolder, $privateFolder | Out-Null

$stamp = Get-Date -Format "yyyyMMddHHmmssfff"
$copyDb = [System.IO.Path]::GetFullPath((Join-Path $copyFolder "IMPORT1A-$stamp.db"))
$restoreDb = [System.IO.Path]::GetFullPath((Join-Path $restoreFolder "IMPORT1A-$stamp.db"))
$privateRoot = [System.IO.Path]::GetFullPath((Join-Path $privateFolder "IMPORT1A-$stamp"))
$targets = @($copyDb, $restoreDb, $privateRoot)
foreach ($target in $targets) {
  if (-not $target.StartsWith($qaRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "QA_TARGET_OUTSIDE_VERIFIED_ROOT"
  }
}

Copy-Item -LiteralPath $sourceDb -Destination $copyDb
Copy-Item -LiteralPath $sourceDb -Destination $restoreDb

try {
  $env:DATABASE_URL = "file:$($copyDb.Replace('\','/'))"
  & (Join-Path $workspace "node_modules\.bin\prisma.cmd") migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "IMPORT1A_SOURCE_COPY_MIGRATION_FAILED" }

  $env:DATABASE_URL = "file:$($restoreDb.Replace('\','/'))"
  & (Join-Path $workspace "node_modules\.bin\prisma.cmd") migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "IMPORT1A_RESTORE_COPY_MIGRATION_FAILED" }

  $env:DATABASE_URL = "file:$($copyDb.Replace('\','/'))"
  $env:IMPORT1A_RESTORE_DATABASE_URL = "file:$($restoreDb.Replace('\','/'))"
  $env:ONBOARDING_STORAGE_ROOT = $privateRoot
  & (Join-Path $workspace "node_modules\.bin\tsx.cmd") (Join-Path $workspace "scripts\qa-import1a-copied-db.ts")
  if ($LASTEXITCODE -ne 0) { throw "IMPORT1A_COPIED_DATABASE_HARNESS_FAILED" }
}
finally {
  foreach ($target in $targets) {
    if (Test-Path -LiteralPath $target) {
      $resolved = [System.IO.Path]::GetFullPath($target)
      if (-not $resolved.StartsWith($qaRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "QA_CLEANUP_TARGET_OUTSIDE_VERIFIED_ROOT"
      }
      Remove-Item -LiteralPath $resolved -Recurse -Force
    }
  }
}
