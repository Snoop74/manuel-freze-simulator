@echo off
rem Freze simulatoru: yerel sunucuyu baslatir ve oyunu tarayicida acar. Kapatmak icin bu pencereyi kapatin (ya da Ctrl+C).
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8790

rem port zaten aciksa (ornegin Claude'un sunucusu) yalnizca tarayiciyi ac
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo Sunucu zaten calisiyor: http://localhost:%PORT%/freze.html
  start "" "http://localhost:%PORT%/freze.html"
  timeout /t 3 >nul
  exit /b
)

where python >nul 2>&1
if errorlevel 1 (
  echo Python bulunamadi. python.org'dan kurun ya da "py -m http.server %PORT%" deneyin.
  pause
  exit /b 1
)

echo Freze sunucusu: http://localhost:%PORT%/freze.html
echo Kapatmak icin bu pencereyi kapatin.
start "" "http://localhost:%PORT%/freze.html"
python -m http.server %PORT%
