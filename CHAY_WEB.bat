@echo off
title DANG CHAY WEB NHOM - KHONG DUOC TAT CUA SO NAY
color 0A
echo =======================================================
echo DANG DON DEP PORT VA KHOI DONG SERVER...
echo =======================================================

taskkill /F /IM node.exe /IM cloudflared.exe >nul 2>&1

echo.
echo [1/2] Dang bat Server Node.js...
start /b node server.js

timeout /t 3 /nobreak >nul

echo.
echo [2/2] Dang tao duong dan WEBPAGE KHONG DOI MAT KHAU...
echo =======================================================
echo COPY DUONG LINK "https://...lhr.life" BEN DUOI DE GUI CHO NHOM:
echo =======================================================
echo.

ssh -o StrictHostKeyChecking=no -R 80:127.0.0.1:3000 nokey@localhost.run

pause