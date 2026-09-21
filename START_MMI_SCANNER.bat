@echo off
title MMI Scanner - Auto Launcher
echo ========================================================
echo        STARTING MARKET MINDS SCANNER (24/7)
echo ========================================================

cd /d "%~dp0"

echo [*] Starting Backend Server (Port 5000)...
start "MMI Backend Server" /min cmd /c "node server/dist/index.js"

timeout /t 2 /nobreak >nul

echo [*] Starting Frontend Server (Port 5173)...
start "MMI Frontend" /min cmd /c "cd client && npm run dev"

timeout /t 2 /nobreak >nul

echo [*] Opening App in Browser...
start http://localhost:5173

echo ========================================================
echo   MMI Scanner is running! You can minimize this window.
echo ========================================================
pause
