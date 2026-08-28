@echo off
REM Create a production build of Nalanda School Management System.
REM Run this after changing the app and before a real-data go-live.
cd /d "%~dp0.."
echo Building Nalanda School Management System...
call pnpm.cmd build
echo.
if errorlevel 1 (
  echo BUILD FAILED. Review the errors above.
) else (
  echo BUILD COMPLETED SUCCESSFULLY.
)
pause
