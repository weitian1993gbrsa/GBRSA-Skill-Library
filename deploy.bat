@echo off
echo =======================================
echo    CHECKING DEPENDENCIES...
echo =======================================

if not exist node_modules (
    echo [INFO] node_modules not found. Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b %ERRORLEVEL%
    )
)

echo.
echo =======================================
echo    BUILDING IJRU SKILL LIBRARY...
echo =======================================
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] BUILD FAILED! Please check the errors above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo =======================================
echo    DEPLOYING TO FIREBASE HOSTING...
echo =======================================
call npx firebase-tools deploy

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] DEPLOY FAILED! Did you run "npx firebase login" first?
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo =======================================
echo    SUCCESSFULLY DEPLOYED!
echo =======================================
pause
