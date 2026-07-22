@echo off
REM Start Nalanda Fee Control in development mode from the project folder.
REM This window stays open so startup messages and errors remain visible.
cd /d "%~dp0.."
echo Starting Nalanda Fee Control...
call pnpm.cmd dev
echo.
echo The development server stopped. Review any message above.
pause
