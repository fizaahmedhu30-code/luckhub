@echo off
title LuckHub Bangladesh Casino Startup
echo ========================================================
echo         🎰 LuckHub BD Casino Startup (BDT ৳)
echo ========================================================

set PATH=C:\Users\ASUS\AppData\Local\Programs\nodejs;C:\Users\ASUS\AppData\Local\Programs\mongodb\bin;C:\Users\ASUS\AppData\Local\Programs\Git\cmd;%PATH%

echo [1/3] Starting MongoDB Database...
start "LuckHub MongoDB" /B "C:\Users\ASUS\AppData\Local\Programs\mongodb\bin\mongod.exe" --dbpath "C:\Users\ASUS\AppData\Local\Programs\mongodb\data" --bind_ip 127.0.0.1 --port 27017
timeout /t 2 >nul

echo [2/3] Starting Backend Express API (Port 5000)...
start "LuckHub Backend" /D "C:\Users\ASUS\.gemini\antigravity\scratch\luckhub\backend" cmd /k "node server.js"
timeout /t 3 >nul

echo [3/3] Starting Frontend Next.js Server (Port 3000)...
start "LuckHub Frontend" /D "C:\Users\ASUS\.gemini\antigravity\scratch\luckhub\frontend" cmd /k "npm run dev"

echo.
echo ========================================================
echo  🎰 LuckHub Bangladesh is now RUNNING!
echo  🌐 Main Site:      http://localhost:3000
echo  🔧 Backend API:    http://localhost:5000/api
echo.
echo  Demo Credentials:
echo   - Player Login:  player@luckhub.com   (Pass: Player@123456)
echo   - Admin Login:   admin@luckhub.com    (Pass: Admin@123456)
echo.
echo  Payment Support:  bKash, Nagad, Rocket, Upay (৳ BDT)
echo ========================================================
pause
