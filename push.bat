@echo off
set REPO_URL=https://github.com/Finu-call/habit.git

echo.
echo ==========================================
echo   HabitFlow Push Script
echo ==========================================
echo Repo: %REPO_URL%
echo.

echo [+] Initializing Git repository...
git init

echo.
echo [+] Adding files to staging...
git add .

echo.
echo [+] Committing files...
git commit -m "feat: add 10:50 PM, 11:00 PM, 11:15 PM and 11:20 PM notification schedule"

echo.
echo [+] Renaming branch to main...
git branch -M main

echo.
echo [+] Setting up remote origin...
git remote add origin %REPO_URL% 2>nul
git remote set-url origin %REPO_URL%

echo.
echo [+] Pushing to GitHub (Main)...
git push -u origin main

echo.
echo ==========================================
echo   Done! Your changes are synced.
echo ==========================================
pause
