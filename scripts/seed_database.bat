@echo off
echo ====================================================
echo Initializing NEXUS Database and Seeding Demo Accounts...
echo ====================================================
call .venv\Scripts\activate.bat
python -m backend.app.db.init_db
