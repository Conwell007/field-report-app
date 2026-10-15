@echo off
title Daily Site Report Web App
echo Starting Daily Site Report System...
cd /d "%~dp0"
node server.js
pause
