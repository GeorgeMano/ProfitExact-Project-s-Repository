@echo off
chcp 65001 >nul
title ProfitExact - publicare pe GitHub
cd /d "%~dp0"

echo ==========================================
echo   ProfitExact - publicare pe GitHub
echo ==========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo EROARE: Git nu este instalat sau nu este in PATH.
  pause
  exit /b 1
)

echo Verific ce este deja pe GitHub...
git fetch origin
if errorlevel 1 (
  echo.
  echo EROARE: nu m-am putut conecta la GitHub. Verifica internetul si contul.
  pause
  exit /b 1
)

for /f %%i in ('git rev-parse HEAD') do set LOCAL=%%i
for /f %%i in ('git rev-parse origin/main') do set REMOTE=%%i
if not "%LOCAL%"=="%REMOTE%" (
  echo.
  echo ATENTIE: pe GitHub exista modificari care nu sunt pe acest calculator,
  echo sau proiectul nu e pe ultima versiune publicata. Nu public nimic,
  echo ca sa nu se piarda nimic. Trimite-i lui Claude mesajul de mai sus.
  pause
  exit /b 1
)

set MSG=%TEMP%\profitexact-mesaj-publicare.txt
if exist "%MSG%" del "%MSG%"
if exist "mesaj-publicare.txt" move /y "mesaj-publicare.txt" "%MSG%" >nul

git switch main
if errorlevel 1 (
  echo.
  echo EROARE: nu am putut trece pe ramura main. Nu am publicat nimic.
  pause
  exit /b 1
)

echo.
echo Fisierele care se publica:
git add -A
git status --short
echo.

if exist "%MSG%" (
  git commit -F "%MSG%"
) else (
  git commit -m "chore: actualizare ProfitExact"
)
if errorlevel 1 (
  echo.
  echo Nu exista nimic nou de publicat.
  pause
  exit /b 0
)
if exist "%MSG%" del "%MSG%"

echo.
echo Trimit pe GitHub...
git push origin main
if errorlevel 1 (
  echo.
  echo EROARE la trimitere. Modificarile sunt salvate local; incearca din nou.
  pause
  exit /b 1
)

echo.
echo Gata. Ultima versiune publicata:
git log -1 --oneline
echo.
pause
