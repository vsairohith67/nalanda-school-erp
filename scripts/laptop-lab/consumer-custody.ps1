# Local Windows-only custody adapter; no creation/ACL repair/cleanup of roots.
# Requests contain public digests and registered path identity, never secrets.
$ErrorActionPreference = 'Stop'
try {
  $text = [Console]::In.ReadToEnd()
  if ($text.Length -gt 4096) { throw 'BOUND' }
  $r = $text | ConvertFrom-Json
  if ($r.operation -notin @('inspect','claim','verify') -or $r.claimKey -notmatch '^[a-f0-9]{64}$' -or $r.authorizationSha256 -notmatch '^[a-f0-9]{64}$') { throw 'REQUEST' }
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  if ($sid -ne $r.custody.userSid -or $r.custody.kind -ne 'WINDOWS_NTFS_LOCAL_V1') { throw 'IDENTITY' }
  $root = [IO.Path]::GetFullPath($r.custody.directory)
  if ($root -cne $r.custody.directory -or $root -notmatch '^[A-Z]:\\.+' -or $root.EndsWith('\')) { throw 'PATH' }
  $volume = Get-CimInstance -ClassName Win32_LogicalDisk -Filter ("DeviceID='" + $root.Substring(0,2) + "'")
  if ($volume.DriveType -ne 3 -or $volume.FileSystem -ne 'NTFS' -or $volume.VolumeSerialNumber -cne $r.custody.volumeSerial) { throw 'VOLUME' }
  for ($cursor=$root; $cursor; $cursor=[IO.Path]::GetDirectoryName($cursor)) {
    $item=Get-Item -Force -LiteralPath $cursor
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'REPARSE' }
  }
  function Assert-PrivatePath([string]$file,[bool]$directory) {
    $item=Get-Item -Force -LiteralPath $file
    if ([bool]$item.PSIsContainer -ne $directory -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'TYPE' }
    $acl=Get-Acl -LiteralPath $file
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid) { throw 'OWNER' }
    $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
    if ($rules.Count -ne 2) { throw 'ACL' }
    $seen=@{}
    foreach($rule in $rules) {
      $id=$rule.IdentityReference.Value
      if ($id -notin @($sid,'S-1-5-18') -or $seen.ContainsKey($id) -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne [Security.AccessControl.FileSystemRights]::FullControl) { throw 'ACL' }
      $seen[$id]=$true
      if ($directory -and (($rule.InheritanceFlags -band [Security.AccessControl.InheritanceFlags]::ContainerInherit) -eq 0 -or ($rule.InheritanceFlags -band [Security.AccessControl.InheritanceFlags]::ObjectInherit) -eq 0 -or $rule.PropagationFlags -ne [Security.AccessControl.PropagationFlags]::None)) { throw 'INHERITANCE' }
    }
    if ($directory -and $file -eq $root -and !$acl.AreAccessRulesProtected) { throw 'INHERITED_ROOT' }
  }
  Assert-PrivatePath $root $true
  $dockerConfig=Join-Path $root 'docker-config'
  Assert-PrivatePath $dockerConfig $true
  $pending=[Collections.Generic.Stack[string]]::new();$pending.Push($dockerConfig);$count=0
  while($pending.Count -gt 0) {
    foreach($entry in (Get-ChildItem -LiteralPath $pending.Pop() -Force)) {
      $count++;if($count -gt 64){throw 'CONFIG_BOUND'}
      Assert-PrivatePath $entry.FullName ([bool]$entry.PSIsContainer)
      if($entry.PSIsContainer){$pending.Push($entry.FullName)}
    }
  }
  foreach($name in @($r.authorizationName,$r.endorsementName)) {
    if ($name -notmatch '^(authorization-[a-f0-9]{32}|endorsement-[1-9][0-9]{0,19}-[1-9][0-9]{0,3})\.json$') { throw 'NAME' }
    Assert-PrivatePath (Join-Path $root $name) $false
  }
  $file=Join-Path $root ('consumed-local-'+$r.claimKey+'.json')
  $receipt=@{contract='NALANDA_LOCAL_RUNTIME_CONSUMED_V1';claimKey=$r.claimKey;authorizationSha256=$r.authorizationSha256}
  if ($r.operation -eq 'claim') {
    # Atomic CreateNew burns the semantic run before any lifecycle effect.
    # Flush(true)/WriteThrough is not a claim of power-loss/recovery approval.
    $stream=[IO.FileStream]::new($file,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough)
    try {$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($receipt|ConvertTo-Json -Compress));$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)} finally {$stream.Dispose()}
  }
  if ($r.operation -ne 'inspect') {
    Assert-PrivatePath $file $false
    if ((Get-Item -LiteralPath $file).Length -gt 1024) { throw 'RECEIPT_BOUND' }
    $saved=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
    if (@($saved.PSObject.Properties).Count -ne 3 -or $saved.contract -ne $receipt.contract -or $saved.claimKey -cne $receipt.claimKey -or $saved.authorizationSha256 -cne $receipt.authorizationSha256) { throw 'RECEIPT' }
  } elseif(Test-Path -LiteralPath $file) { throw 'REPLAY' }
  @{contract='NALANDA_LOCAL_CUSTODY_CHECK_V1';operation=$r.operation;claimKey=$r.claimKey;authorizationSha256=$r.authorizationSha256}|ConvertTo-Json -Compress
} catch { [Console]::Error.WriteLine('LOCAL_CUSTODY_REFUSED'); exit 1 }
