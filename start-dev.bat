@echo off
echo ===================================================
echo   Starting Abdi E-Commerce Store
echo   1. Backend (Port 5000)
echo   2. Frontend (Port 3000)
echo ===================================================
start "Abdi Backend Server" cmd /k "npm run dev"
start "Abdi Frontend Client" cmd /k "cd frontend && npm run dev"
echo Both servers have been launched in separate windows!
