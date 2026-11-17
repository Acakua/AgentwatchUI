@echo off
setlocal
cd /d "%~dp0"
title AgentwatchUI
where node >nul 2>nul
if errorlevel 1 (
  echo Khong tim thay Node.js. Hay cai Node 22.5 tro len: https://nodejs.org
  pause
  exit /b 1
)
if "%PORT%"=="" set PORT=4780
echo AgentwatchUI dang chay tai http://127.0.0.1:%PORT%
echo Dong cua so nay de tat.
start "" "http://127.0.0.1:%PORT%"
node server.js
pause
