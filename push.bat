@echo off
echo Initializing Git repository...
git init

echo.
echo Adding files to staging...
git add .

echo.
echo Committing files...
git commit -m "feat: implement background push notifications, PWA support, and updated reminder schedule"

echo.
echo Renaming branch to main...
git branch -M main

echo.
echo Adding remote origin (https://github.com/Finu-call/habit.git)...
git remote add origin https://github.com/Finu-call/habit.git 2>nul
git remote set-url origin https://github.com/Finu-call/habit.git

echo.
echo Pushing to GitHub...
git push -u origin main

echo.
echo Done! Press any key to exit.
pause
