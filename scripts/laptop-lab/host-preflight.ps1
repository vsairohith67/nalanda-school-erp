# Read-only capabilities, not runtime readiness or a capacity test.
$ErrorActionPreference = 'Stop'
$labOs = Get-CimInstance Win32_OperatingSystem
$labCpu = Get-CimInstance Win32_Processor
$labDisk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
[pscustomobject]@{
    evidence = 'HOST_CAPABILITY_ONLY'
    capturedUtc = [DateTime]::UtcNow.ToString('o')
    os = $labOs.Caption
    osVersion = $labOs.Version
    cpu = ($labCpu.Name -join ', ')
    physicalCores = ($labCpu.NumberOfCores | Measure-Object -Sum).Sum
    logicalProcessors = ($labCpu.NumberOfLogicalProcessors | Measure-Object -Sum).Sum
    usableRamGiB = [math]::Round($labOs.TotalVisibleMemorySize / 1MB, 2)
    freeRamGiB = [math]::Round($labOs.FreePhysicalMemory / 1MB, 2)
    diskSizeGiB = [math]::Round($labDisk.Size / 1GB, 2)
    diskFreeGiB = [math]::Round($labDisk.FreeSpace / 1GB, 2)
    dockerCliPresent = [bool](Get-Command docker -ErrorAction SilentlyContinue)
    wslCliPresent = [bool](Get-Command wsl -ErrorAction SilentlyContinue)
    containerDaemon = 'NOT_PROBED'
    wslDistribution = 'NOT_PROBED'
    temperature = 'UNAVAILABLE'
    throttling = 'UNAVAILABLE'
    uncontendedWindow = 'NOT_ESTABLISHED'
    runtimePermission = 'NOT_ADMITTED'
} | ConvertTo-Json
