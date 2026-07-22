@echo off
REM Run the complete release check: TypeScript, tests, then production build.
REM The next command runs only when the previous command succeeds.
cd /d "%~dp0.."
echo Running typecheck, tests, and production build...
call pnpm.cmd typecheck && call pnpm.cmd test && call pnpm.cmd build
echo.
if errorlevel 1 (
  echo CHECKS FAILED. Review the first error above.
) else (
  echo ALL CHECKS PASSED.
)
pause
