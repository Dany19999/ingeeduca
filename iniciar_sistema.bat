@echo off
title INGEDUCA CORP - Sistema Completo
cd /d "%~dp0"
echo =======================================================
echo INGEDUCA CORP - Iniciando Backend y Frontend
echo =======================================================
start "Backend FastAPI" cmd /k "iniciar_backend.bat"
start "Frontend Vite" cmd /k "iniciar_frontend.bat"
echo Sistema levantado en segundo plano.

