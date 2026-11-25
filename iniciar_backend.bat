@echo off
title INGEDUCA CORP - Backend FastAPI
cd /d "%~dp0"
echo =======================================================
echo INGEDUCA CORP - AulaPredict API v2.0
echo Levantando servidor FastAPI con Gemini 3.6 Flash...
echo Puerto: 8000
echo =======================================================
.\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause

