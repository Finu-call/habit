@echo off
set REPO_URL=https://github.com/Finu-call/habit.git

echo.
echo ==========================================
echo   Habiq Push Script
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
git commit -m "feat: rebrand to Habiq and update onboarding flow to default to create account"

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
