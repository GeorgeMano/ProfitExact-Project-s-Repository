@echo off
title ProfitExact
cd /d "%~dp0"

where node >nul 2>nul || (echo Node.js lipseste: https://nodejs.org & pause & exit /b 1)

call npm install --no-audit --no-fund --silent || (pause & exit /b 1)

start "" cmd /c "timeout /t 8 >nul && start """" http://localhost:3000"
call npm run dev
pause
