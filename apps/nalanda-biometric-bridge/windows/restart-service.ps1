param([Parameter(Mandatory=$true)][string]$HostConfig,[string]$TargetComputer,[string]$ConfirmApply,[switch]$Apply)
& "$PSScriptRoot\companion.ps1" -Action Restart @PSBoundParameters
