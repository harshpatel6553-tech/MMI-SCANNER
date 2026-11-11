#!/bin/bash
set -e

# Enter directory of this script
cd "$(dirname "$0")"

echo "=========================================="
echo "🚀 Updating MMI-SCANNER Production Server"
echo "=========================================="

echo "📥 1. Pulling latest code from GitHub..."
git fetch origin main 2>/dev/null || git fetch --all 2>/dev/null || true
git reset --hard origin/main 2>/dev/null || git pull origin main 2>/dev/null || git pull || true

# Check if docker works with or without sudo
if [ "$EUID" -eq 0 ]; then
    DKR="docker"
elif docker ps >/dev/null 2>&1; then
    DKR="docker"
else
    DKR="sudo docker"
fi

echo "🔨 2. Building fresh Docker image using $DKR..."
$DKR build -t mmi-scanner .

echo "🛑 3. Stopping and removing old container..."
$DKR stop mmi-scanner 2>/dev/null || true
$DKR rm mmi-scanner 2>/dev/null || true
# Stop any container built from mmi-server or mmi-scanner
OLD_CONTAINERS=$($DKR ps -q --filter ancestor=mmi-server --filter ancestor=mmi-scanner 2>/dev/null || true)
if [ -n "$OLD_CONTAINERS" ]; then
    $DKR stop $OLD_CONTAINERS 2>/dev/null || true
    $DKR rm $OLD_CONTAINERS 2>/dev/null || true
fi
# Free port 5000 if still held by any lingering process
sudo fuser -k 5000/tcp 2>/dev/null || true

echo "▶️ 4. Starting updated container on port 5000..."
$DKR run -d --name mmi-scanner --restart always -p 5000:5000 mmi-scanner

echo "🔍 5. Checking status of containers..."
$DKR ps

echo "=========================================="
echo "✅ SUCCESS! Server is updated & live!"
echo "=========================================="
