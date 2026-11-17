@echo off
title STANZ G - Online Multiplayer Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed on this PC.
  echo  Download and install it from https://nodejs.org (the LTS version),
  echo  then double-click this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing server dependencies - this only happens once...
  call npm install
  if errorlevel 1 (
    echo.
    echo  Something went wrong installing dependencies. Scroll up to see why.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Starting the STANZ G server. Keep this window open while you play.
echo Closing this window ends the match for everyone connected.
echo.
node server.js
pause
