# Private stdin/stdout adapter. Never emit command lines, credentials or callback URLs.
$ErrorActionPreference = 'Stop'
try {
  $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
  if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows') { throw 'WINDOWS_DISPOSABLE_RUNNER_REQUIRED' }
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  if ($request.operation -eq 'listeners') {
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq [int]$request.port } | ForEach-Object { @{address=$_.LocalAddress; port=[int]$_.LocalPort; pid=[int]$_.OwningProcess} })
    ConvertTo-Json -InputObject $listeners -Compress
    exit 0
  }
  if ($request.operation -eq 'environment') {
    $scheme = Get-ItemProperty -LiteralPath 'Registry::HKEY_CLASSES_ROOT\nalandaps-erp\shell\open\command'
    $http = Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice'
    @{ userSid=$identity.User.Value; userProfile=[Environment]::GetFolderPath('UserProfile'); roaming=[Environment]::GetFolderPath('ApplicationData'); local=[Environment]::GetFolderPath('LocalApplicationData'); protocolCommand=$scheme.'(default)'; browserProgId=$http.ProgId } | ConvertTo-Json -Compress
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
