# Imported policy has no side effects. Mutations occur only in explicitly invoked functions.
function Invoke-AclCommand([string]$Exe,[string[]]$Arguments) {
  & $Exe @Arguments | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "COMPANION_EXTERNAL_FAILED:$LASTEXITCODE" }
}
function Private-Acl([string]$Directory,[string]$Identity,[string]$Rights) {
  $acl=New-Object Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true,$false)
  $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
  foreach ($entry in @(@('S-1-5-18','FullControl'),@('S-1-5-32-544','FullControl'),@($Identity,$Rights))) {
    $sid=New-Object Security.Principal.SecurityIdentifier($entry[0])
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sid,$entry[1],'ContainerInherit,ObjectInherit','None','Allow')))
  }
  Set-Acl -LiteralPath $Directory -AclObject $acl
  Invoke-AclCommand "$env:SystemRoot\System32\icacls.exe" @($Directory,'/setowner','*S-1-5-32-544','/T')
  Invoke-AclCommand "$env:SystemRoot\System32\icacls.exe" @($Directory,'/reset','/T')
  Set-Acl -LiteralPath $Directory -AclObject $acl
}
function Protect-CompanionService([string]$Name) {
  if ($Name -notmatch '^NalandaBiometric[A-Za-z0-9_-]{1,48}$') {throw 'COMPANION_SERVICE_NAME_INVALID'}
  Invoke-AclCommand "$env:SystemRoot\System32\sc.exe" @('sdset',$Name,'D:(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)')
}
Export-ModuleMember -Function Private-Acl,Protect-CompanionService
