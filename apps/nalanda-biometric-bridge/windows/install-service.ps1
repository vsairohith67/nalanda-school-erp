param([Parameter(Mandatory=$true)][string]$HostConfig,[string]$HostExe,[string]$TargetComputer,[string]$ConfirmApply,[switch]$Apply)
& "$PSScriptRoot\companion.ps1" -Action Install @PSBoundParameters
