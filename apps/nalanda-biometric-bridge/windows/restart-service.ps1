$ErrorActionPreference='Stop';Restart-Service -Name 'NalandaBiometricBridge' -Force;Get-Service -Name 'NalandaBiometricBridge'
