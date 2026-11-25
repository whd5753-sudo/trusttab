@echo off
rem TrustTab dev mode - AI oracle + web dev server + http://trusttab.localhost:5173/
chcp 65001 >nul
cd /d "%~dp0"
title TrustTab (dev)
node start.mjs --dev %*
if errorlevel 1 pause
