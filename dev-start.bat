@echo off
setlocal EnableExtensions

call "%~dp0dev-config.bat"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-start.ps1"
exit /b %ERRORLEVEL%
