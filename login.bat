@echo off
echo =======================================
echo    LOGGING INTO FIREBASE...
echo    (A browser window will open shortly)
echo =======================================
call npx firebase-tools login

echo.
echo =======================================
echo    IF YOU SEE "SUCCESS" IN BROWSER,
echo    YOU CAN NOW RUN deploy.bat!
echo =======================================
pause
