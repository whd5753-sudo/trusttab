@echo off
rem TrustTab - double click: AI oracle + open TrustTab site in Edge. Close this window (or Ctrl+C) to stop.
chcp 65001 >nul
cd /d "%~dp0"
title TrustTab
node start.mjs %*
if errorlevel 1 pause
