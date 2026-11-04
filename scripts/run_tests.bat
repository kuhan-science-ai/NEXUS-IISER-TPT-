@echo off
echo ====================================================
echo Running NEXUS Automated Test Suite (Pytest)...
echo ====================================================
call .venv\Scripts\activate.bat
pytest tests/ -v
