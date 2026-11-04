@echo off
echo ====================================================
echo Starting NEXUS FastAPI Backend Server (Port 8000)...
echo ====================================================
call .venv\Scripts\activate.bat
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
