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

if not exist "node_modules" (
  echo Instalez dependintele. Dureaza un minut, e normal...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo EROARE la instalarea dependintelor.
    pause
    exit /b 1
  )
  echo.
)

echo Pornesc serverul. Browserul se deschide singur in cateva secunde.
echo Ca sa opresti serverul: apasa Ctrl+C in fereastra asta.
echo.

start "" cmd /c "timeout /t 8 >nul && start """" http://localhost:3000"

call npm run dev

echo.
echo Serverul s-a oprit.
pause
