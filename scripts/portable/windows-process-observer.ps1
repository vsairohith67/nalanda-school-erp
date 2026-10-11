# Owned, bounded process-start observation. Never reads command lines or emits URLs.
$ErrorActionPreference = 'Stop'
$subscription = $null
$sourceId = $null
try {
  $line = [Console]::In.ReadLine()
  if (!$line -or $line.Length -gt 4096) { throw 'OBSERVER_INPUT' }
  $inputValue = $line | ConvertFrom-Json
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:PORTABLE_CI_EXCEPTION -ne 'OWNER_AUTHORIZED' -or $inputValue.sid -ne $sid -or $inputValue.source -ne $env:EXPECTED_SHA -or $inputValue.runId -ne $env:GITHUB_RUN_ID -or $inputValue.attempt -ne $env:GITHUB_RUN_ATTEMPT) { throw 'OBSERVER_OWNER' }
  if (@($inputValue.PSObject.Properties.Name).Count -ne 4) { throw 'OBSERVER_FIELDS' }
  $sourceId = 'NalandaOwnedProcess-' + [Guid]::NewGuid().ToString('N')
  $subscription = Register-CimIndicationEvent -Query "SELECT * FROM Win32_ProcessStartTrace WHERE ProcessName = 'nalanda-cross-platform.exe'" -SourceIdentifier $sourceId
  $self = Get-CimInstance Win32_Process -Filter "ProcessId = $PID"
  @{kind='READY'; process=@{pid=$PID; created=$self.CreationDate.ToUniversalTime().ToString('o'); executable=$self.ExecutablePath; sha256=(Get-FileHash -LiteralPath $self.ExecutablePath -Algorithm SHA256).Hash.ToLowerInvariant(); userSid=$sid}} | ConvertTo-Json -Depth 3 -Compress
  $stop = [Console]::In.ReadLineAsync()
  $deadline = [DateTime]::UtcNow.AddMinutes(15)
  $count = 0
  while (!$stop.IsCompleted -and [DateTime]::UtcNow -lt $deadline) {
    $event = Wait-Event -SourceIdentifier $sourceId -Timeout 1
    if (!$event) { continue }
    $row = $event.SourceEventArgs.NewEvent
    $count++
    if ($count -gt 64) { throw 'OBSERVER_BOUND' }
    $eventSid = (New-Object Security.Principal.SecurityIdentifier($row.Sid,0)).Value
    @{kind='START'; pid=[int]$row.ProcessID; parentPid=[int]$row.ParentProcessID; userSid=$eventSid; image=$row.ProcessName; at=[DateTime]::FromFileTimeUtc([long]$row.TIME_CREATED).ToString('o')} | ConvertTo-Json -Compress
    Remove-Event -EventIdentifier $event.EventIdentifier
  }
  if (!$stop.IsCompleted -or $stop.Result -ne 'STOP') { throw 'OBSERVER_STOP_REQUIRED' }
} catch { [Console]::Error.WriteLine('WINDOWS_PROCESS_OBSERVER_FAILED'); exit 1 }
finally {
  if ($sourceId -and $subscription) {
    Unregister-Event -SourceIdentifier $sourceId -ErrorAction Stop
    # No -Action was registered, so there is no background job to remove.
    Get-Event -SourceIdentifier $sourceId -ErrorAction SilentlyContinue | ForEach-Object { Remove-Event -EventIdentifier $_.EventIdentifier -ErrorAction Stop }
  }
}
