@echo off
setlocal DisableDelayedExpansion
set "NODE_EXE="
for %%I in (node.exe) do set "NODE_EXE=%%~$PATH:I"
if not defined NODE_EXE (
  echo BLOCKED: Node.js was not found on PATH.
  exit /b 1
)
"%NODE_EXE%" "%~dp0worktree-manager.mjs" list
exit /b %ERRORLEVEL%
