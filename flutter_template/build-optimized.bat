@echo off
REM build-optimized.bat - Optimized Flutter Web Build Script for Windows

echo Starting optimized Flutter web build...

REM Clean previous build
echo Cleaning previous build...
flutter clean

REM Get dependencies
echo Getting dependencies...
flutter pub get

REM Build with HTML renderer for faster initial load
echo Building with HTML renderer...
flutter build web --web-renderer html --release

REM Navigate to build directory
cd build\web

REM Compress assets if PowerShell is available
echo Compressing assets...
where powershell >nul 2>nul
if %errorlevel%==0 (
    echo Compressing JavaScript files...
    powershell -Command "Get-ChildItem -Path . -Filter *.js -Recurse | ForEach-Object { $content = Get-Content $_.FullName -Raw; $compressed = [System.IO.Compression.GZipStream]::new([System.IO.File]::Create($_.FullName + '.gz'), [System.IO.Compression.CompressionMode]::Compress); $bytes = [System.Text.Encoding]::UTF8.GetBytes($content); $compressed.Write($bytes, 0, $bytes.Length); $compressed.Close() }"
    
    echo Compressing CSS files...
    powershell -Command "Get-ChildItem -Path . -Filter *.css -Recurse | ForEach-Object { $content = Get-Content $_.FullName -Raw; $compressed = [System.IO.Compression.GZipStream]::new([System.IO.File]::Create($_.FullName + '.gz'), [System.IO.Compression.CompressionMode]::Compress); $bytes = [System.Text.Encoding]::UTF8.GetBytes($content); $compressed.Write($bytes, 0, $bytes.Length); $compressed.Close() }"
) else (
    echo Warning: PowerShell not found. Skipping compression.
)

REM Return to project root
cd ..\..

REM Generate service worker for PWA caching
echo Building PWA with offline support...
flutter build web --web-renderer html --release --pwa-strategy=offline-first

echo Build completed successfully!
echo Optimized files are in build\web\
echo.
echo To serve locally, run:
echo   cd build\web ^&^& python -m http.server 8000
echo Then open: http://localhost:8000

pause