@echo off
REM Create a timestamped JSON backup in the project's backups folder.
REM Copy completed backups to a separate USB drive or protected folder.
cd /d "%~dp0.."
echo Creating Nalanda Fee Control backup...
call pnpm.cmd backup
echo.
if errorlevel 1 (
  echo BACKUP FAILED. Review the errors above.
) else (
  echo BACKUP COMPLETED SUCCESSFULLY. Check the backups folder.
)
pause
