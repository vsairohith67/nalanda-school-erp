# Fixed private stdin contract. Only an explicitly admitted disposable CI identity.
# Public certificate only. Never LocalMachine, browser defaults, or personal profiles.
$ErrorActionPreference = 'Stop'
$store = $null
$added = $false
try {
  $raw = [Console]::In.ReadToEnd()
  if ($raw.Length -gt 32768) { throw 'INPUT_BOUND' }
  $q = $raw | ConvertFrom-Json
  $expected = @('operation','root','userSid','source','runId','attempt','profileSha256','caSha256','caDer')
  if ((@($q.PSObject.Properties.Name | Sort-Object) -join ',') -ne (($expected | Sort-Object) -join ',')) { throw 'INPUT_FIELDS' }
  if ($q.operation -notin @('prepare','verify','cleanup')) { throw 'OPERATION' }
  if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows' -or $env:PORTABLE_CI_EXCEPTION -ne 'OWNER_AUTHORIZED' -or $env:GITHUB_REPOSITORY -ne 'vsairohith67/nalanda-school-erp') { throw 'DISPOSABLE_IDENTITY_REQUIRED' }
  if ($q.source -cne $env:EXPECTED_SHA -or $q.runId -cne $env:GITHUB_RUN_ID -or $q.attempt -cne $env:GITHUB_RUN_ATTEMPT -or $q.source -notmatch '^[a-f0-9]{40}$' -or $q.runId -notmatch '^\d{1,20}$' -or $q.attempt -notmatch '^\d{1,6}$') { throw 'RUN_BINDING' }
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  if ($sid -cne $q.userSid) { throw 'FOREIGN_IDENTITY' }
  $root = [IO.Path]::GetFullPath($q.root)
  $temporary = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\') + '\'
  if (!$root.StartsWith($temporary, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $root) -cne "run-$($q.runId)-$($q.attempt)" -or !(Test-Path -LiteralPath $root -PathType Container)) { throw 'FOREIGN_ROOT' }
  $cursor = $root
  while ($cursor) {
    if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'REPARSE_ROOT' }
    $parent = Split-Path -Parent $cursor
    if ($parent -eq $cursor) { break }; $cursor = $parent
  }
  $acl = Get-Acl -LiteralPath $root
  if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid -or !$acl.AreAccessRulesProtected) { throw 'ROOT_OWNERSHIP' }
  foreach ($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
    if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @($sid,'S-1-5-18','S-1-5-32-544')) { throw 'ROOT_ACL' }
  }
  if ($q.caSha256 -notmatch '^[a-f0-9]{64}$' -or $q.profileSha256 -notmatch '^[a-f0-9]{64}$') { throw 'IDENTITY' }
  $der = [Convert]::FromBase64String($q.caDer)
  if ($der.Length -gt 8192) { throw 'CERTIFICATE_BOUND' }
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { $digest = ([BitConverter]::ToString($hasher.ComputeHash($der))).Replace('-','').ToLowerInvariant() } finally { $hasher.Dispose() }
  if ($digest -cne $q.caSha256) { throw 'CERTIFICATE_CHANGED' }
  $cert = New-Object Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList @(,$der)
  if ($cert.HasPrivateKey -or ($q.operation -ne 'cleanup' -and ($cert.NotBefore.ToUniversalTime() -gt [DateTime]::UtcNow -or $cert.NotAfter.ToUniversalTime() -le [DateTime]::UtcNow))) { throw 'CERTIFICATE_INVALID' }
  $journal = Join-Path $root 'native-qa-trust-owner.json'
  $store = New-Object Security.Cryptography.X509Certificates.X509Store('Root','CurrentUser')
  $store.Open([Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
  function Exact-Certificates {
    @($store.Certificates | Where-Object { $_.Thumbprint -ceq $cert.Thumbprint -and [Convert]::ToBase64String($_.RawData) -ceq $q.caDer })
  }
  function Write-State($value,$create) {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Compress))
    $mode = if ($create) { [IO.FileMode]::CreateNew } else { [IO.FileMode]::Truncate }
    $file = [IO.File]::Open($journal,$mode,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $file.Write($bytes,0,$bytes.Length); $file.Flush($true) } finally { $file.Dispose() }
  }
  if ($q.operation -eq 'prepare') {
    $preexisting = (Exact-Certificates).Count -gt 0
    $state = @{contract='NALANDA_WINDOWS_QA_TRUST_V1';userSid=$sid;source=$q.source;runId=$q.runId;attempt=$q.attempt;profileSha256=$q.profileSha256;caSha256=$digest;caDer=$q.caDer;preexisting=$preexisting;state='PREPARED'}
    Write-State $state $true
    if (!$preexisting) { $store.Add($cert); $added=$true }
    if ((Exact-Certificates).Count -ne 1) { throw 'STORE_READBACK' }
    $state.state='INSTALLED'; Write-State $state $false
    @{state='INSTALLED';preexisting=$preexisting;store='CurrentUser/Root';browserHandshake='NOT_EXECUTED';webviewHandshake='NOT_EXECUTED'} | ConvertTo-Json -Compress
  } else {
    $item=Get-Item -LiteralPath $journal -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.LinkType -or $item.Length -gt 16384) { throw 'JOURNAL_UNSAFE' }
    $state=Get-Content -LiteralPath $journal -Raw | ConvertFrom-Json
    if ((($state.PSObject.Properties.Name | Sort-Object) -join ',') -cne 'attempt,caDer,caSha256,contract,preexisting,profileSha256,runId,source,state,userSid') { throw 'JOURNAL_FIELDS' }
    foreach ($field in @('userSid','source','runId','attempt','profileSha256','caSha256','caDer')) { if ($state.$field -cne $q.$field) { throw 'JOURNAL_FOREIGN' } }
    if ($state.contract -cne 'NALANDA_WINDOWS_QA_TRUST_V1' -or $state.preexisting -isnot [bool] -or $state.state -notin @('INSTALLED','REMOVED')) { throw 'AMBIGUOUS_SETUP_RECONCILIATION_REQUIRED' }
    if ($q.operation -eq 'verify') {
      if ($state.state -ne 'INSTALLED' -or (Exact-Certificates).Count -ne 1) { throw 'TRUST_MISSING' }
      @{state='VERIFIED';store='CurrentUser/Root';browserHandshake='NOT_EXECUTED';webviewHandshake='NOT_EXECUTED'} | ConvertTo-Json -Compress
    } else {
      if (!$state.preexisting) { foreach ($exact in (Exact-Certificates)) { $store.Remove($exact) }; if ((Exact-Certificates).Count -ne 0) { throw 'CLEANUP_RESIDUE' } }
      elseif ((Exact-Certificates).Count -ne 1) { throw 'PREEXISTING_TRUST_CHANGED' }
      $state.state='REMOVED'; Write-State $state $false
      @{state='CLEANED';preexistingPreserved=[bool]$state.preexisting;store='CurrentUser/Root'} | ConvertTo-Json -Compress
    }
  }
} catch {
  # In-process addition is unambiguous. A PREPARED journal after uncatchable
  # termination is deliberately NOT permission to delete an existing root.
  if ($added -and $store) {
    try { foreach ($exact in (Exact-Certificates)) { $store.Remove($exact) }; if ((Exact-Certificates).Count -ne 0) { throw 'RESIDUE' } }
    catch { [Console]::Error.WriteLine('WINDOWS_QA_TRUST_CLEANUP_RESIDUE_RECONCILIATION_REQUIRED'); exit 1 }
  }
  [Console]::Error.WriteLine('WINDOWS_QA_TRUST_REFUSED_RECONCILIATION_REQUIRED'); exit 1
} finally { if ($store) { $store.Close(); $store.Dispose() } }
