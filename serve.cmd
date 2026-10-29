@echo off
REM Serve this folder over http and open it. Double-click to run.
REM Recipe Book cannot run from file:// because browsers block ES modules
REM and service workers there.

setlocal
set PORT=8765
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 goto :python_launcher

where python >nul 2>nul
if %errorlevel%==0 goto :python

where npx >nul 2>nul
if %errorlevel%==0 goto :npx

echo.
echo Could not find Python or Node on this machine.
echo Install either one, or use any other static file server in this folder.
echo.
pause
exit /b 1

:python_launcher
echo Serving on http://localhost:%PORT%/   (close this window to stop)
start "" "http://localhost:%PORT%/"
py -m http.server %PORT% --bind 127.0.0.1
exit /b

:python
echo Serving on http://localhost:%PORT%/   (close this window to stop)
start "" "http://localhost:%PORT%/"
python -m http.server %PORT% --bind 127.0.0.1
exit /b

:npx
echo Serving on http://localhost:%PORT%/   (close this window to stop)
start "" "http://localhost:%PORT%/"
npx --yes serve -l %PORT%
exit /b
