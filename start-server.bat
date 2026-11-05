@echo off
title Sunrise Villa Server
cd /d "%~dp0"
echo ============================================
echo   Sunrise Villa server start ho raha hai...
echo   Website: http://localhost:3000
echo   Phone:   http://192.168.137.1:3000
echo ============================================
echo.
echo Band karne ke liye ye window close kar dena.
echo.
node server.js
pause
