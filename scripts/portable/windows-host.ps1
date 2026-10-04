# Private stdin/stdout adapter. Never emit command lines, credentials or callback URLs.
$ErrorActionPreference = 'Stop'
try {
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows') { throw 'WINDOWS_DISPOSABLE_RUNNER_REQUIRED' }
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  if ($request.operation -in @('profile-claim','profile-cleanup')) {
    $target = $request.target
    if ($env:PORTABLE_CI_EXCEPTION -ne 'OWNER_AUTHORIZED' -or $identity.User.Value -ne $target.userSid -or $env:EXPECTED_SHA -ne $target.source -or $env:GITHUB_RUN_ID -ne $target.runId -or $env:GITHUB_RUN_ATTEMPT -ne $target.attempt) { throw 'WINDOWS_PROFILE_OWNER_REFUSED' }
    $root = [IO.Path]::GetFullPath($target.root).TrimEnd('\')
    if ([IO.Path]::GetFileName($root) -ne "run-$($target.runId)-$($target.attempt)" -or [Environment]::GetFolderPath('UserProfile') -ne $target.userProfile -or [Environment]::GetFolderPath('ApplicationData') -ne $target.roaming -or [Environment]::GetFolderPath('LocalApplicationData') -ne $target.local) { throw 'WINDOWS_PROFILE_ROOT_REFUSED' }
    $directories = @((Join-Path $target.roaming 'com.nalandaps.erp'),(Join-Path $target.local 'com.nalandaps.erp'),(Join-Path $target.local 'Microsoft\Edge\User Data'))
    if ($directories[0] -ne $target.appData -or $directories[1] -ne $target.webviewData -or $directories[2] -ne $target.browserData) { throw 'WINDOWS_PROFILE_PATH_REFUSED' }
    $receiptPath = Join-Path $root 'windows-profile-owner.json'
    foreach ($candidate in @($root,$receiptPath) + $directories) {
      $absolute = [IO.Path]::GetFullPath($candidate)
      if ($absolute -ne $root -and !$absolute.StartsWith($root + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'WINDOWS_PROFILE_ESCAPE' }
      $cursor = $absolute
      while ($cursor) {
        if (Test-Path -LiteralPath $cursor) { if ((Get-Item -Force -LiteralPath $cursor).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'WINDOWS_PROFILE_REPARSE' } }
        $cursor = [IO.Path]::GetDirectoryName($cursor)
      }
    }
    $owner = @{contract='NALANDA_WINDOWS_PROFILE_OWNER_V1'; source=$target.source; runId=$target.runId; attempt=$target.attempt; userSid=$target.userSid; directories=$directories}
    if ($request.operation -eq 'profile-claim') {
      foreach ($dir in $directories) { if (Test-Path -LiteralPath $dir) { throw 'WINDOWS_PROFILE_ALREADY_EXISTS' } }
      $stream = [IO.File]::Open($receiptPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
      try { $bytes = [Text.Encoding]::UTF8.GetBytes(($owner | ConvertTo-Json -Depth 4 -Compress)); $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
      @{state='FRESH_PROFILES_CLAIMED'} | ConvertTo-Json -Compress
      exit 0
    }
    $receipt = Get-Content -Raw -LiteralPath $receiptPath | ConvertFrom-Json
    if (@($receipt.PSObject.Properties.Name).Count -ne 6 -or $receipt.contract -ne $owner.contract -or $receipt.source -ne $owner.source -or $receipt.runId -ne $owner.runId -or $receipt.attempt -ne $owner.attempt -or $receipt.userSid -ne $owner.userSid -or ($receipt.directories -join '|') -ne ($directories -join '|')) { throw 'WINDOWS_PROFILE_RECEIPT_REFUSED' }
    # Validate every descendant BEFORE any removal. No path comes from a glob,
    # another shell, an unverified receipt or a user-selectable cleanup argument.
    foreach ($dir in $directories) {
      if (!(Test-Path -LiteralPath $dir)) { continue }
      $entries = @((Get-Item -Force -LiteralPath $dir)) + @(Get-ChildItem -Force -Recurse -LiteralPath $dir)
      if ($entries.Count -gt 50000) { throw 'WINDOWS_PROFILE_CLEANUP_BOUND' }
      foreach ($entry in $entries) {
        $full = [IO.Path]::GetFullPath($entry.FullName)
        if (($full -ne $dir -and !$full.StartsWith($dir + '\',[StringComparison]::OrdinalIgnoreCase)) -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'WINDOWS_PROFILE_DESCENDANT_REFUSED' }
        $acl = Get-Acl -LiteralPath $full
        if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $identity.User.Value) { throw 'WINDOWS_PROFILE_FOREIGN_OWNER' }
      }
    }
    foreach ($dir in $directories) { if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction Stop }; if (Test-Path -LiteralPath $dir) { throw 'WINDOWS_PROFILE_CLEANUP_INCOMPLETE' } }
    # Retain the non-secret ownership receipt as teardown evidence.
    @{state='OWNED_PROFILES_REMOVED'} | ConvertTo-Json -Compress
    exit 0
  }
  if ($request.operation -eq 'file-security') {
    $acl = Get-Acl -LiteralPath $request.file
    $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]) | ForEach-Object { @{sid=$_.IdentityReference.Value; type=$_.AccessControlType.ToString(); inherited=$_.IsInherited} })
    @{userSid=$identity.User.Value; owner=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value; protected=$acl.AreAccessRulesProtected; rules=$rules} | ConvertTo-Json -Depth 4 -Compress
    exit 0
  }
  if ($request.operation -eq 'listeners') {
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq [int]$request.port } | ForEach-Object { @{address=$_.LocalAddress; port=[int]$_.LocalPort; pid=[int]$_.OwningProcess} })
    ConvertTo-Json -InputObject $listeners -Compress
    exit 0
  }
  if ($request.operation -eq 'webview-policy') {
    # Fixed executable name only; never inspect or mutate another application's
    # browser settings. Machine/global overrides make provenance ambiguous.
    $values = @{}
    $machine = $false; $wildcard = $false; $environment = $false
    foreach ($name in @('AdditionalBrowserArguments','BrowserExecutableFolder','UserDataFolder')) {
      $suffix = "Software\Policies\Microsoft\Edge\WebView2\$name"
      $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($suffix)
      try { $values[$name] = if ($key) { $key.GetValue('nalanda-cross-platform.exe',$null) } else { $null }; if ($key -and $null -ne $key.GetValue('*',$null)) { $wildcard = $true } } finally { if ($key) { $key.Dispose() } }
      $key = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey($suffix)
      try { if ($key -and ($null -ne $key.GetValue('*',$null) -or $null -ne $key.GetValue('nalanda-cross-platform.exe',$null))) { $machine = $true } } finally { if ($key) { $key.Dispose() } }
    }
    foreach ($name in @('WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS','WEBVIEW2_BROWSER_EXECUTABLE_FOLDER','WEBVIEW2_USER_DATA_FOLDER','WEBVIEW2_PIPE_FOR_SCRIPT_DEBUGGER','WEBVIEW2_WAIT_FOR_SCRIPT_DEBUGGER')) { if ([Environment]::GetEnvironmentVariable($name)) { $environment = $true } }
    @{arguments=$values.AdditionalBrowserArguments; folder=$values.BrowserExecutableFolder; userData=$values.UserDataFolder; machineOverride=$machine; wildcardOverride=$wildcard; environmentOverride=$environment} | ConvertTo-Json -Compress
    exit 0
  }
  if ($request.operation -eq 'browser-protocol-policy') {
    $name = 'AutoLaunchProtocolsFromOrigins'; $suffix = 'Software\Policies\Microsoft\Edge'
    $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($suffix)
    try { $value = if ($key) { $key.GetValue($name,$null) } else { $null } } finally { if ($key) { $key.Dispose() } }
    $key = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey($suffix)
    try { $machine = $key -and $null -ne $key.GetValue($name,$null) } finally { if ($key) { $key.Dispose() } }
    @{value=$value; machineOverride=[bool]$machine} | ConvertTo-Json -Compress
    exit 0
  }
  if ($request.operation -eq 'environment') {
    $scheme = Get-ItemProperty -LiteralPath 'Registry::HKEY_CLASSES_ROOT\nalandaps-erp\shell\open\command'
    $http = Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice'
    $browser = Get-ItemProperty -LiteralPath 'Registry::HKEY_CLASSES_ROOT\MSEdgeHTM\shell\open\command'
    @{ userSid=$identity.User.Value; userProfile=[Environment]::GetFolderPath('UserProfile'); roaming=[Environment]::GetFolderPath('ApplicationData'); local=[Environment]::GetFolderPath('LocalApplicationData'); protocolCommand=$scheme.'(default)'; browserProgId=$http.ProgId; browserCommand=$browser.'(default)' } | ConvertTo-Json -Compress
    exit 0
  }
  if ($request.operation -eq 'processes') {
    $rows = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $request.executable })
    $result = @($rows | ForEach-Object {
      $owner = Invoke-CimMethod -InputObject $_ -MethodName GetOwnerSid
      @{ pid=[int]$_.ProcessId; parentPid=[int]$_.ParentProcessId; created=$_.CreationDate.ToUniversalTime().ToString('o'); executable=$_.ExecutablePath; sha256=(Get-FileHash -LiteralPath $_.ExecutablePath -Algorithm SHA256).Hash.ToLowerInvariant(); userSid=$owner.Sid }
    })
    ConvertTo-Json -InputObject $result -Compress
    exit 0
  }
  if ($request.operation -notin @('stop','background','foreground')) { throw 'WINDOWS_OPERATION_REFUSED' }
  $expected = $request.process
  $found = Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$expected.pid)"
  if (!$found -or $found.CreationDate.ToUniversalTime().ToString('o') -ne $expected.created -or $found.ExecutablePath -ne $expected.executable) { throw 'WINDOWS_PROCESS_CHANGED' }
  $owner = Invoke-CimMethod -InputObject $found -MethodName GetOwnerSid
  if ($owner.Sid -ne $identity.User.Value -or $owner.Sid -ne $expected.userSid -or (Get-FileHash -LiteralPath $found.ExecutablePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected.sha256) { throw 'WINDOWS_FOREIGN_PROCESS' }
  if ($request.operation -eq 'stop') { Stop-Process -Id ([int]$expected.pid) -ErrorAction Stop; @{stopped=$true} | ConvertTo-Json -Compress; exit 0 }
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class OwnedWindow {
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
}
'@
  $window = (Get-Process -Id ([int]$expected.pid)).MainWindowHandle
  if ($window -eq [IntPtr]::Zero) { throw 'WINDOWS_OWNED_WINDOW_MISSING' }
  if ($request.operation -eq 'background') { [void][OwnedWindow]::ShowWindow($window,6) }
  else { [void][OwnedWindow]::ShowWindow($window,9); if (![OwnedWindow]::SetForegroundWindow($window)) { throw 'WINDOWS_FOREGROUND_REFUSED' } }
  @{completed=$true} | ConvertTo-Json -Compress
} catch { [Console]::Error.WriteLine('WINDOWS_HOST_OPERATION_REFUSED'); exit 1 }
