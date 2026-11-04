#!/bin/bash
set -e

# Enter directory of this script
cd "$(dirname "$0")"

echo "=========================================="
echo "🚀 Updating MMI-SCANNER Production Server"
echo "=========================================="

echo "📥 1. Pulling latest code from GitHub..."
git pull origin main || git pull

# Check if docker works with or without sudo
if docker ps >/dev/null 2>&1; then
    DKR="docker"
elif sudo -n docker ps >/dev/null 2>&1; then
    DKR="sudo docker"
else
    DKR="docker"
fi

echo "🔨 2. Building fresh Docker image using $DKR..."
$DKR build -t mmi-scanner .

echo "🛑 3. Stopping and removing old container..."
$DKR stop mmi-scanner 2>/dev/null || true
$DKR rm mmi-scanner 2>/dev/null || true

echo "▶️ 4. Starting updated container on port 5000..."
$DKR run -d --name mmi-scanner --restart always -p 5000:5000 mmi-scanner

echo "🔍 5. Checking status of containers..."
$DKR ps

echo "=========================================="
echo "✅ SUCCESS! Server is updated & live!"
echo "=========================================="

