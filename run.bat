@echo off
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
npm run dev
pause
