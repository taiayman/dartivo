#!/bin/bash
# build-optimized.sh - Optimized Flutter Web Build Script

echo "Starting optimized Flutter web build..."

# Clean previous build
echo "Cleaning previous build..."
flutter clean

# Get dependencies
echo "Getting dependencies..."
flutter pub get

# Build with HTML renderer for faster initial load
echo "Building with HTML renderer..."
flutter build web --web-renderer html --release

# Navigate to build directory
cd build/web

# Compress JavaScript and CSS assets
echo "Compressing assets..."
if command -v gzip &> /dev/null; then
    echo "Compressing JavaScript files..."
    find . -name "*.js" -exec gzip -9 -k -f {} \;
    
    echo "Compressing CSS files..."
    find . -name "*.css" -exec gzip -9 -k -f {} \;
    
    echo "Compressing JSON files..."
    find . -name "*.json" -exec gzip -9 -k -f {} \;
else
    echo "Warning: gzip not found. Skipping compression."
fi

# Return to project root
cd ../..

# Generate service worker for PWA caching
echo "Building PWA with offline support..."
flutter build web --web-renderer html --release --pwa-strategy=offline-first

echo "Build completed successfully!"
echo "Optimized files are in build/web/"
echo ""
echo "To serve locally, run:"
echo "  cd build/web && python -m http.server 8000"
echo "Then open: http://localhost:8000"