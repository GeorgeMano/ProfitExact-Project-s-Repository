@echo off
title ProfitExact - server local
cd /d "%~dp0"

echo ==========================================
echo   ProfitExact - pornire server local
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo EROARE: Node.js nu este instalat sau nu este in PATH.
  echo Descarca-l de la https://nodejs.org si incearca din nou.
  echo.
  pause
  exit /b 1
)

rem Instalarea ruleaza de fiecare data: e rapida cand nu e nimic nou si
rem aduce automat pachetele adaugate in proiect de la ultima pornire.
echo Verific dependintele. Prima data dureaza un minut, e normal...
echo.
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo EROARE la instalarea dependintelor.
  pause
  exit /b 1
)
echo.

echo Pornesc serverul. Browserul se deschide singur in cateva secunde.
echo Ca sa opresti serverul: apasa Ctrl+C in fereastra asta.
echo.

start "" cmd /c "timeout /t 8 >nul && start """" http://localhost:3000"

call npm run dev

echo.
echo Serverul s-a oprit.
pause
