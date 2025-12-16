@echo off
echo ================================
echo Starting Pocket Signals System
echo ================================
echo.

echo Starting Backend...
start "Backend API" cmd /k "cd backend && npm start"

timeout /t 3 /nobreak >nul

echo Starting Admin Panel...
start "Admin Panel" cmd /k "cd admin-panel && node server.js"

echo.
echo ================================
echo Both servers starting...
echo ================================
echo Backend API: http://localhost:3000
echo Admin Panel: http://localhost:8080
echo ================================
echo.
echo Press any key to close this window (servers will keep running)
pause >nul
